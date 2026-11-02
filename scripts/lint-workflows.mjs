import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VERSION = "1.7.11";
// Official v1.7.11 release asset SHA-256 values, pinned before download:
// https://github.com/rhysd/actionlint/releases/tag/v1.7.11
// https://api.github.com/repos/rhysd/actionlint/releases/tags/v1.7.11
const RELEASES = {
  "linux-x64": ["linux_amd64", "900919a84f2229bac68ca9cd4103ea297abc35e9689ebb842c6e34a3d1b01b0a"],
  "linux-arm64": ["linux_arm64", "21bc0dfb57a913fe175298c2a9e906ee630f747cb66d0a934d0d4b69f4ee1235"],
  "darwin-x64": ["darwin_amd64", "17ffc17fed8f0258ef6ad4aed932d3272464c7ef7d64e1cb0d65aa97c9752107"],
  "darwin-arm64": ["darwin_arm64", "a21ba7366d8329e7223faee0ed69eb13da27fe8acabb356bb7eb0b7f1e1cb6d8"],
};
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;

function run(executable, args, cwd, input) {
  const result = spawnSync(executable, args, {
    cwd, input, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"], shell: false,
  });
  if (result.error || result.signal) throw new Error("Workflow lint subprocess failed or timed out.");
  return result;
}

/** Real semantic regression probes: invalid job-level runner context must fail. */
export function lintWorkflows(executable, cwd = process.cwd()) {
  const invalid = ["name: Invalid runner context", "on: push", "jobs:", "  check:",
    "    runs-on: ubuntu-latest", "    env:",
    "      RELEASE_DIR: ${{ runner.temp }}/skillwhy-release", "    steps:",
    "      - run: echo ok", ""].join("\n");
  const corrected = ["name: Valid runner context", "on: push", "jobs:", "  check:",
    "    runs-on: ubuntu-latest", "    steps:", "      - run: echo ok", "        env:",
    "          RELEASE_DIR: ${{ runner.temp }}/skillwhy-release", ""].join("\n");
  // Optional shellcheck/pyflakes installations should not change this workflow
  // schema/expression gate between developer machines and hosted runners.
  const flags = ["-shellcheck=", "-pyflakes="];
  const rejected = run(executable, [...flags, "-"], cwd, invalid);
  if (rejected.status !== 1 || !/context "runner" is not allowed here/u.test(rejected.stdout + rejected.stderr)) {
    throw new Error("actionlint did not reject the invalid runner-context regression fixture.");
  }
  const accepted = run(executable, [...flags, "-"], cwd, corrected);
  if (accepted.status !== 0) throw new Error("actionlint rejected the corrected runner-context regression fixture.");

  const workflows = readdirSync(join(cwd, ".github", "workflows"))
    .filter(name => /\.ya?ml$/u.test(name)).sort().map(name => `.github/workflows/${name}`);
  if (workflows.length === 0) throw new Error("No GitHub workflows found to lint.");
  const result = run(executable, [...flags, ...workflows], cwd);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error("actionlint found invalid workflow definitions.");
  return { version: VERSION, workflows: workflows.length, runnerContextRegression: "passed" };
}

export async function verifyAndLint(cwd = process.cwd()) {
  const release = RELEASES[`${process.platform}-${process.arch}`];
  if (!release) throw new Error("Pinned actionlint downloads support Linux/macOS x64 and arm64.");
  const [platform, expectedHash] = release;
  const response = await fetch(`https://github.com/rhysd/actionlint/releases/download/v${VERSION}/actionlint_${VERSION}_${platform}.tar.gz`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || !response.body) throw new Error("Could not download the pinned actionlint release.");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_ARCHIVE_BYTES) throw new Error("actionlint archive exceeded the download limit.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("actionlint archive SHA-256 does not match the pinned official release.");
  const directory = mkdtempSync(join(tmpdir(), "skillwhy-actionlint-"));
  try {
    const archive = join(directory, "actionlint.tar.gz");
    writeFileSync(archive, bytes, { flag: "wx", mode: 0o600 });
    const extracted = run("tar", ["-xzf", archive, "-C", directory, "actionlint"], cwd);
    if (extracted.status !== 0) throw new Error("Could not extract the verified actionlint executable.");
    const executable = join(directory, "actionlint");
    chmodSync(executable, 0o700);
    return lintWorkflows(executable, cwd);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await verifyAndLint())); }
  catch (error) { console.error(error instanceof Error ? error.message : "Workflow lint failed."); process.exitCode = 1; }
}
