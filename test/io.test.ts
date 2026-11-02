import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MAX_SNAPSHOT_BYTES, readSnapshot, writeSnapshot } from "../src/io.js";
import type { Snapshot } from "../src/types.js";

function example(): Snapshot {
  return {
    schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: "test-snapshot",
    capture: {
      host: "codex-cli", hostVersion: "0.158.0", adapterVersion: "0.1.0-alpha.1",
      surface: "fresh-cli-app-server", cwdAlias: "repo", status: "complete",
      capturedAt: "2026-11-02T11:30:00.000Z", synthetic: true,
    },
    coverage: {
      inventory: "complete-for-request", includedEntries: "all-returned", roots: "unknown",
      resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed",
    },
    rootMappings: [], entries: [], findings: [], errors: [],
  };
}

async function workspace(): Promise<string> {
  return mkdtemp(join(await realpath(tmpdir()), "skillwhy-io-"));
}

test("snapshot files round-trip and are created private and exclusively", async (context) => {
  const root = await workspace();
  context.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "snapshot.json");
  await writeSnapshot(path, example());
  assert.deepEqual(await readSnapshot(path), example());
  if (process.platform !== "win32") assert.equal((await stat(path)).mode & 0o777, 0o600);
  const before = await readFile(path, "utf8");
  await assert.rejects(writeSnapshot(path, example()));
  assert.equal(await readFile(path, "utf8"), before);
});

test("snapshot reads and writes refuse final symlinks and symlink parents", async (context) => {
  const root = await workspace();
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "target.json");
  await writeSnapshot(target, example());
  const link = join(root, "link.json");
  await symlink(target, link);
  await assert.rejects(readSnapshot(link));
  await assert.rejects(writeSnapshot(link, example()));
  assert.deepEqual(await readSnapshot(target), example());
  await mkdir(join(root, "actual"));
  await symlink(join(root, "actual"), join(root, "linked"), "dir");
  await assert.rejects(writeSnapshot(join(root, "linked", "new.json"), example()));
  await writeSnapshot(join(root, "actual", "source.json"), example());
  await assert.rejects(readSnapshot(join(root, "linked", "source.json")));
});

test("missing parents are not created and invalid snapshots are not written", async (context) => {
  const root = await workspace();
  context.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(writeSnapshot(join(root, "absent", "new.json"), example()));
  const invalid = { ...example(), schemaVersion: 2 } as unknown as Snapshot;
  const path = join(root, "invalid.json");
  await assert.rejects(writeSnapshot(path, invalid));
  await assert.rejects(stat(path));
});

test("malformed, oversized and non-snapshot JSON are rejected", async (context) => {
  const root = await workspace();
  context.after(() => rm(root, { recursive: true, force: true }));
  const invalid = join(root, "invalid.json");
  await writeFile(invalid, "{\"secret\": \"CANARY");
  await assert.rejects(readSnapshot(invalid), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes("CANARY"));
    return true;
  });
  await writeFile(invalid, "{}");
  await assert.rejects(readSnapshot(invalid));
  await writeFile(invalid, Buffer.alloc(MAX_SNAPSHOT_BYTES + 1, 0x20));
  await assert.rejects(readSnapshot(invalid), /8 MiB/);
  await assert.rejects(readSnapshot(root), /regular file|EISDIR/);
});
