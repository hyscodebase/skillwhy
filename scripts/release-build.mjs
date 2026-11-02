import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkPackage } from "./release-check.mjs";

export function buildRelease({ cwd = process.cwd(), outputDirectory } = {}) {
  if (!outputDirectory) throw new Error("RELEASE_DIR must name a new output directory outside the repository.");
  const metadata = checkPackage(cwd);
  const out = resolve(outputDirectory);
  if (out === resolve(cwd) || out.startsWith(`${resolve(cwd)}/`)) throw new Error("Release output must be outside the repository.");
  mkdirSync(out, { mode: 0o700 }); // Exclusive directory creation prevents stale asset reuse.
  const run = (command, args, workdir = cwd) => execFileSync(command, args, {
    cwd: workdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
  });
  run("npm", ["run", "build"]);
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", out]));
  const archive = packed?.[0];
  if (packed.length !== 1 || archive?.name !== metadata.name || archive?.version !== metadata.version ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tgz$/.test(archive.filename)) {
    throw new Error("npm pack returned unexpected metadata.");
  }
  const prefix = mkdtempSync(join(tmpdir(), "skillwhy-install-"));
  try {
    run("npm", ["install", "--prefix", prefix, "--ignore-scripts", "--omit=dev", "--package-lock=false",
      "--no-audit", "--no-fund", join(out, archive.filename)], prefix);
    const bin = join(prefix, "node_modules", ".bin", "skillwhy");
    if (run(process.execPath, [bin, "--version"], prefix).trim() !== metadata.version) {
      throw new Error("Installed tarball --version does not match package.json.");
    }
    const demo = JSON.parse(run(process.execPath, [bin, "demo", "--json"], prefix));
    if (demo.status !== "complete" || demo.synthetic !== true ||
        !demo.differences?.some((item) => item.kind === "enabled-changed")) {
      throw new Error("Installed tarball demo did not produce the expected synthetic comparison.");
    }
  } finally { rmSync(prefix, { recursive: true, force: true }); }
  const digest = (name) => createHash("sha256").update(readFileSync(join(out, name))).digest("hex");
  const tarDigest = digest(archive.filename);
  writeFileSync(join(out, "SHA256SUMS"), `${tarDigest}  ${archive.filename}\n`, { flag: "wx", mode: 0o600 });
  const commit = run("git", ["rev-parse", "HEAD^{commit}"]).trim();
  const manifest = { schemaVersion: 1, ...metadata, commit, files: [archive.filename, "SHA256SUMS"].map((name) => ({
    name, sha256: digest(name), size: readFileSync(join(out, name)).length,
  })) };
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(buildRelease({ outputDirectory: process.env.RELEASE_DIR }))); }
  catch (error) { console.error(error instanceof Error ? error.message : "Release packaging failed."); process.exitCode = 1; }
}
