import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, realpath, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoSnapshots } from "../src/demo.js";

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
  assert.match(human.stdout, /SYNTHETIC EXAMPLE/);
  assert.match(human.stdout, /NOT OBSERVED/);
});

test("bad arguments consistently fail with exit 2", async () => {
  for (const args of [["nope"], ["demo", "--out", "ignored.json"], ["--unrecognized"], ["diff", "only-one"], ["capture", "--cwd", "."]]) {
    const result = await run(args);
    assert.equal(result.code, 2, `${args.join(" ")}: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /at main|node:internal/);
  }
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
