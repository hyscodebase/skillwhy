import assert from "node:assert/strict";
import test from "node:test";
import { createShareBundle } from "../src/share.js";
import { parseSnapshot } from "../src/validate.js";
import type { Snapshot } from "../src/types.js";

function privateSnapshot(): Snapshot {
  const secret = "CANARY_PRIVATE_SECRET";
  return {
    schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: secret,
    capture: {
      host: "codex-cli", hostVersion: secret, adapterVersion: secret,
      surface: "fresh-cli-app-server", cwdAlias: secret, status: "partial",
      capturedAt: "2026-11-02T11:30:00.000Z", synthetic: false,
    },
    coverage: {
      inventory: "partial", includedEntries: "all-returned", roots: "unknown",
      resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed",
    },
    rootMappings: [{ alias: secret, role: secret, userConfirmed: false }],
    entries: [{
      entryId: secret, name: secret, label: secret, comparisonKey: secret,
      nativeScope: secret, enabled: false, locationAlias: secret, sourcePath: `/Users/${secret}/SKILL.md`,
      content: { status: "collected", algorithm: "sha256", coverage: ["SKILL.md"], digest: "a".repeat(64) },
      evidence: [
        { field: "enabled", level: "observed", source: "skills/list", reference: secret },
        { field: "digest", level: "observed", source: "filesystem", reference: secret },
        { field: secret, level: "inferred", source: "filesystem", reference: secret },
      ],
    }],
    findings: [{ code: secret, level: "unknown", entryIds: [secret] }],
    errors: [{ code: secret, scope: secret }],
  };
}

test("sharing rebuilds every field and removes private canaries by default", () => {
  const source = privateSnapshot();
  const before = JSON.stringify(source);
  const shared = createShareBundle(source, { entryIds: [source.entries[0]!.entryId], alias: "release-review" });
  assert.ok(!JSON.stringify(shared).includes("CANARY_PRIVATE_SECRET"));
  assert.equal(JSON.stringify(source), before);
  assert.equal(shared.entries[0]!.name, null);
  assert.equal(shared.entries[0]!.content.digest, null);
  assert.equal(shared.entries[0]!.content.status, "redacted");
  assert.equal(shared.entries[0]!.enabled, false);
  assert.equal(shared.entries[0]!.sourcePath, undefined);
  assert.equal(shared.entries[0]!.comparisonKey, "selected:release-review");
  assert.equal(shared.capture.status, "partial");
  assert.equal(shared.coverage.inventory, "partial");
  assert.equal(shared.coverage.includedEntries, "selected");
  assert.equal(shared.capture.hostVersion, "unknown");
  assert.equal(shared.errors.length, source.errors.length);
  assert.deepEqual(shared.rootMappings, [{ alias: "selected", role: "selected", userConfirmed: true }]);
  assert.equal(parseSnapshot(shared), shared);
});

test("name and digest require separate explicit opt-ins", () => {
  const source = privateSnapshot();
  const selection = { entryIds: [source.entries[0]!.entryId], alias: "public" };
  const named = createShareBundle(source, { ...selection, includeName: true });
  assert.equal(named.entries[0]!.name, source.entries[0]!.name);
  assert.equal(named.entries[0]!.content.digest, null);
  const hashed = createShareBundle(source, { ...selection, includeDigest: true });
  assert.equal(hashed.entries[0]!.name, null);
  assert.equal(hashed.entries[0]!.content.digest, "a".repeat(64));
  const both = createShareBundle(source, { ...selection, includeName: true, includeDigest: true });
  assert.equal(both.entries[0]!.name, source.entries[0]!.name);
  assert.equal(both.entries[0]!.content.digest, "a".repeat(64));
  assert.equal(both.entries[0]!.sourcePath, undefined);
  assert.equal(parseSnapshot(both), both);
});

test("sharing requires exactly one unambiguous existing entry and a safe alias", () => {
  const source = privateSnapshot();
  const id = source.entries[0]!.entryId;
  for (const entryIds of [[], ["missing"], [id, id], [id, "missing"]]) {
    assert.throws(() => createShareBundle(source, { entryIds, alias: "public" }));
  }
  for (const alias of ["", "../secret", "full name", "a".repeat(65), "\nCANARY", "한글"]) {
    assert.throws(() => createShareBundle(source, { entryIds: [id], alias }));
  }
  source.entries.push({ ...source.entries[0]! });
  assert.throws(() => createShareBundle(source, { entryIds: [id], alias: "public" }));
});

test("sharing preserves known version, scope and uncertainty without upgrading evidence", () => {
  const source = privateSnapshot();
  source.capture.hostVersion = "codex-cli 0.158.0";
  source.capture.adapterVersion = "0.1.0-alpha.1";
  source.entries[0]!.nativeScope = "repo";
  source.entries[0]!.enabled = null;
  source.entries[0]!.evidence[0]!.level = "unknown";
  const shared = createShareBundle(source, { entryIds: [source.entries[0]!.entryId], alias: "public" });
  assert.equal(shared.capture.hostVersion, "0.158.0");
  assert.equal(shared.capture.adapterVersion, "0.1.0-alpha.1");
  assert.equal(shared.entries[0]!.nativeScope, "repo");
  assert.equal(shared.entries[0]!.enabled, null);
  assert.equal(shared.entries[0]!.evidence.find((item) => item.field === "enabled")!.level, "unknown");
  assert.equal(parseSnapshot(shared), shared);
});

test("capture's content.digest evidence survives an explicit fingerprint opt-in", () => {
  const source = privateSnapshot();
  const selected = source.entries[0]!;
  // This is the evidence shape emitted by captureSnapshot, not a model run.
  selected.evidence = [
    { field: "name", level: "observed", source: "skills/list", reference: "inventory-1" },
    { field: "enabled", level: "observed", source: "skills/list", reference: "inventory-1" },
    { field: "content.digest", level: "observed", source: "filesystem", reference: selected.entryId },
  ];
  const options = { entryIds: [selected.entryId], alias: "public" };
  const defaultShare = createShareBundle(source, options);
  assert.equal(defaultShare.entries[0]!.evidence.some((item) => item.field === "digest"), false);
  const shared = createShareBundle(source, { ...options, includeDigest: true });
  assert.deepEqual(shared.entries[0]!.evidence.find((item) => item.field === "digest"), {
    field: "digest", level: "observed", source: "filesystem", reference: "selected-entry",
  });
  assert.equal(shared.entries[0]!.content.digest, selected.content.digest);
  assert.ok(!JSON.stringify(shared).includes("CANARY_PRIVATE_SECRET"));
  assert.equal(parseSnapshot(shared), shared);
});
