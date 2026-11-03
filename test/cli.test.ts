import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, realpath, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoSnapshots } from "../src/demo.js";
import { VERSION } from "../src/version.js";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
async function run(args: string[]) {
  try { return { ...(await execute(process.execPath, [cli, ...args])), code: 0 }; }
  catch (error) {
    const result = error as Error & { stdout: string; stderr: string; code: number };
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
  }
}

test("offline demo is explicitly synthetic and detects the disabled entry", async () => {
  const result = await run(["demo", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.synthetic, true);
  assert.ok(value.differences.some((d: { kind: string }) => d.kind === "enabled-changed"));
  const human = await run(["demo"]);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Synthetic example; your project was not scanned/);
  assert.match(human.stdout, /release-review: enabled → disabled/);
  assert.match(human.stdout, /No model or Desktop session was inspected/);
  assert.match(human.stdout, /npx --yes @hyscodebase\/skillwhy@alpha capture --cwd \./);
  assert.doesNotMatch(human.stdout, /NOT OBSERVED|NOT ASSESSED|Note:/);
  const detailed = await run(["demo", "--detail"]);
  assert.equal(detailed.code, 0, detailed.stderr);
  assert.match(detailed.stdout, /SYNTHETIC EXAMPLE/);
  assert.match(detailed.stdout, /NOT OBSERVED/);
  assert.match(detailed.stdout, /Note:/);
  assert.deepEqual(JSON.parse((await run(["demo", "--json", "--detail"])).stdout), value);
});

test("bad arguments consistently fail with exit 2", async () => {
  for (const args of [["nope"], ["demo", "--out", "ignored.json"], ["--unrecognized"], ["diff", "only-one"], ["capture", "--cwd", "."], ["inspect"], ["inspect", "one", "two"], ["inspect", "one", "--include-name"]]) {
    const result = await run(args);
    assert.equal(result.code, 2, `${args.join(" ")}: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /at main|node:internal/);
  }
});

test("CLI and adapter versions use the package metadata", async () => {
  const result = await run(["--version"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim(), VERSION);
  assert.equal(demoSnapshots()[0].capture.adapterVersion, VERSION);
});

test("inspect finds duplicate entry IDs without exposing raw source paths or digests", async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "skillwhy-inspect-cli-")));
  try {
    const [snapshot] = demoSnapshots();
    const entry = snapshot.entries[0]!;
    entry.sourcePath = "/private/INSPECT_PATH_CANARY/SKILL.md";
    snapshot.entries.push({ ...structuredClone(entry), entryId: "second-copy", locationAlias: "project/another/SKILL.md" });
    const source = join(dir, "source.json");
    await writeFile(source, JSON.stringify(snapshot));
    const result = await run(["inspect", source, "--skill", "release-review", "--json"]);
    assert.equal(result.code, 0, result.stderr);
    const value = JSON.parse(result.stdout);
    assert.deepEqual(value.entries.map((item: { entryId: string }) => item.entryId), ["demo-entry", "second-copy"]);
    assert.doesNotMatch(result.stdout, /INSPECT_PATH_CANARY|a{64}/);
    const selected = await run(["share", "--snapshot", source, "--entry", value.entries[1].entryId, "--alias", "review", "--preview"]);
    assert.equal(selected.code, 0, selected.stderr);
    const ambiguous = await run(["share", "--snapshot", source, "--skill", "release-review", "--alias", "review", "--preview"]);
    assert.equal(ambiguous.code, 2);
    assert.match(ambiguous.stderr, /skillwhy inspect/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("share CLI exports the preview, refuses overwrite, and supports common selected comparison", async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "skillwhy-cli-")));
  try {
    const [left, right] = demoSnapshots();
    left.entries[0]!.name = "SECRET_ORIGINAL_NAME";
    left.entries[0]!.sourcePath = "/private/SECRET_CANARY/SKILL.md";
    const source = join(dir, "source.json");
    const output = join(dir, "bundle.json");
    const otherSource = join(dir, "other.json");
    const otherOutput = join(dir, "other-bundle.json");
    await writeFile(source, JSON.stringify(left));
    await writeFile(otherSource, JSON.stringify(right));
    const select = ["share", "--snapshot", source, "--entry", "demo-entry", "--alias", "review"];
    const preview = await run([...select, "--preview"]);
    assert.equal(preview.code, 0, preview.stderr);
    assert.doesNotMatch(preview.stdout, /SECRET_ORIGINAL_NAME|SECRET_CANARY/);
    const saved = await run([...select, "--out", output]);
    assert.equal(saved.code, 0, saved.stderr);
    const bundle = JSON.parse(await readFile(output, "utf8"));
    const previewBundle = JSON.parse(preview.stdout);
    // ID/time may be newly generated; the selected evidence must be identical.
    assert.deepEqual(bundle.entries, previewBundle.entries);
    assert.equal((await run([...select, "--out", output])).code, 2);
    assert.equal((await run(["share", "--snapshot", otherSource, "--entry", "demo-entry", "--alias", "review", "--out", otherOutput])).code, 0);
    const compared = await run(["diff", output, otherOutput, "--json"]);
    assert.equal(compared.code, 0, compared.stderr + compared.stdout);
    assert.ok(JSON.parse(compared.stdout).differences.some((d: { kind: string }) => d.kind === "enabled-changed"));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
