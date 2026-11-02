import test from "node:test";
import assert from "node:assert/strict";
import { parseSnapshot } from "../src/validate.js";
import type { Snapshot } from "../src/types.js";

function snapshot(): Snapshot {
  return { schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: "test", capture: { host: "codex-cli", hostVersion: "0.158.0", adapterVersion: "0.1.0", surface: "fresh-cli-app-server", cwdAlias: "project", status: "complete", capturedAt: "2026-11-02T00:00:00.000Z", synthetic: false }, coverage: { inventory: "complete-for-request", includedEntries: "all-returned", roots: "unknown", resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed" }, rootMappings: [{ alias: "project", role: "project", userConfirmed: false }], entries: [{ entryId: "one", name: "review", label: "review", comparisonKey: null, nativeScope: "repo", enabled: true, locationAlias: "project/review/SKILL.md", sourcePath: "/private/project/review/SKILL.md", content: { status: "collected", algorithm: "sha256", coverage: ["SKILL.md"], digest: "a".repeat(64) }, evidence: [{ field: "enabled", level: "observed", source: "skills/list", reference: "entry-0001" }] }], findings: [], errors: [] };
}

function shared(): Snapshot {
  const result = snapshot();
  result.artifactKind = "share-v1";
  result.snapshotId = "share-test";
  result.capture.cwdAlias = "selected";
  result.coverage.includedEntries = "selected";
  result.rootMappings = [{ alias: "selected", role: "selected", userConfirmed: true }];
  const entry = result.entries[0]!;
  delete entry.sourcePath;
  entry.entryId = "selected-entry";
  entry.name = null;
  entry.label = "review";
  entry.comparisonKey = "selected:review";
  entry.locationAlias = "selected/SKILL.md";
  entry.content.status = "redacted";
  entry.content.digest = null;
  entry.evidence[0]!.reference = "selected-entry";
  return result;
}

test("valid private and minimal share snapshots round trip", () => {
  for (const current of [snapshot(), shared()]) assert.deepEqual(parseSnapshot(JSON.parse(JSON.stringify(current))), current);
});

test("unknown fields are rejected at every object boundary without exposing the secret", () => {
  const paths: (string | number)[][] = [[], ["capture"], ["coverage"], ["rootMappings", 0], ["entries", 0], ["entries", 0, "content"], ["entries", 0, "evidence", 0], ["findings", 0], ["errors", 0]];
  for (const path of paths) {
    const current = snapshot();
    current.findings.push({ code: "NOTICE", level: "observed", entryIds: ["one"] });
    current.errors.push({ code: "PARTIAL", scope: "inventory" });
    let target: unknown = current;
    for (const part of path) target = (target as Record<string | number, unknown>)[part];
    (target as Record<string, unknown>).secret_token_path = "super-secret-value";
    assert.throws(() => parseSnapshot(current), error => error instanceof Error && error.message.startsWith("Invalid snapshot") && !error.message.includes("secret") && !error.message.includes("super-secret-value"));
  }
});

test("malformed required fields and unsupported schema versions are rejected", () => {
  for (const value of [null, [], "snapshot", 42, {}, { ...snapshot(), schemaVersion: 2 }, { ...snapshot(), artifactKind: "public" }]) assert.throws(() => parseSnapshot(value), /Invalid snapshot/u);
  const current = snapshot();
  delete (current.capture as unknown as Record<string, unknown>).status;
  assert.throws(() => parseSnapshot(current), /Invalid snapshot/u);
});

test("duplicate identifiers are rejected while duplicate skill names remain valid", () => {
  const current = snapshot();
  current.entries.push({ ...structuredClone(current.entries[0]!), entryId: "two" });
  assert.equal(parseSnapshot(current).entries.length, 2);
  current.entries[1]!.entryId = "one";
  assert.throws(() => parseSnapshot(current), /entryId/u);
  current.entries.pop();
  current.rootMappings.push({ alias: "project", role: "other", userConfirmed: true });
  assert.throws(() => parseSnapshot(current), /alias/u);
});

test("content evidence requires a complete SHA-256 digest exactly when collected", () => {
  const cases: unknown[] = ["a".repeat(63), "z".repeat(64), null, 123];
  for (const digest of cases) {
    const current = snapshot();
    (current.entries[0]!.content as unknown as Record<string, unknown>).digest = digest;
    assert.throws(() => parseSnapshot(current), /digest/u);
  }
  const current = snapshot();
  current.entries[0]!.content.status = "not-requested";
  assert.throws(() => parseSnapshot(current), /digest/u);
  current.entries[0]!.content.digest = null;
  assert.equal(parseSnapshot(current).entries[0]!.content.digest, null);
  (current.entries[0]!.content.coverage as unknown as string[]).push("scripts/run.sh");
  assert.throws(() => parseSnapshot(current), /coverage/u);
});

test("array caps, sparse values, accessors and extra properties are rejected", () => {
  const current = snapshot();
  current.errors = Array.from({ length: 10_001 }, () => ({ code: "ERROR", scope: "inventory" }));
  assert.throws(() => parseSnapshot(current), /errors/u);
  const sparse = snapshot();
  sparse.entries = new Array(1) as Snapshot["entries"];
  assert.throws(() => parseSnapshot(sparse), /entries/u);
  const extra = snapshot();
  Object.defineProperty(extra.entries, "token", { value: "do-not-reflect", enumerable: true });
  assert.throws(() => parseSnapshot(extra), /entries/u);
  let accessed = false;
  const accessor = snapshot();
  Object.defineProperty(accessor.entries, "0", { get() { accessed = true; return {}; }, enumerable: true });
  assert.throws(() => parseSnapshot(accessor), /entries/u);
  assert.equal(accessed, false);
});

test("object accessors and unexpected prototypes are rejected without executing getters", () => {
  let accessed = false;
  const current = snapshot();
  Object.defineProperty(current.capture, "hostVersion", { get() { accessed = true; return "0.1.0"; }, enumerable: true });
  assert.throws(() => parseSnapshot(current), /capture/u);
  assert.equal(accessed, false);
  const inherited = Object.assign(Object.create({ token: "secret" }) as object, snapshot());
  assert.throws(() => parseSnapshot(inherited), /snapshot/u);
});

test("control characters, oversized text and invalid calendar dates are rejected", () => {
  for (const timestamp of ["2026-02-30T00:00:00.000Z", "2026-11-02T25:00:00.000Z", "today", "2026-11-02"]) {
    const current = snapshot();
    current.capture.capturedAt = timestamp;
    assert.throws(() => parseSnapshot(current), /capturedAt/u);
  }
  const current = snapshot();
  current.entries[0]!.name = "line\nsecret";
  assert.throws(() => parseSnapshot(current), /name/u);
  current.entries[0]!.name = "x".repeat(257);
  assert.throws(() => parseSnapshot(current), /name/u);
});

test("findings must refer to returned entry IDs", () => {
  const current = snapshot();
  current.findings = [{ code: "NOTICE", level: "observed", entryIds: ["not-returned"] }];
  assert.throws(() => parseSnapshot(current), /entryIds/u);
});

test("public shares reject paths and raw metadata even inside otherwise allowed fields", () => {
  const mutations: ((current: Snapshot) => void)[] = [
    current => { current.entries[0]!.sourcePath = "/private/secret/SKILL.md"; },
    current => { current.entries[0]!.evidence[0]!.reference = "/private/secret"; },
    current => { current.capture.cwdAlias = "/private/workspace"; },
    current => { current.capture.hostVersion = "0.1.0 token=secret"; },
    current => { current.errors = [{ code: "SOURCE_ERROR_REDACTED", scope: "/private/secret" }]; },
    current => { current.findings = [{ code: "TOKEN_VALUE", level: "observed", entryIds: [] }]; },
    current => { current.entries[0]!.nativeScope = "/private/secret"; },
    current => { current.entries[0]!.comparisonKey = "arbitrary-unconfirmed-key"; },
    current => { current.rootMappings[0]!.userConfirmed = false; },
    current => { current.coverage.includedEntries = "all-returned"; },
  ];
  for (const mutate of mutations) {
    const current = shared();
    mutate(current);
    assert.throws(() => parseSnapshot(current), error => error instanceof Error && !error.message.includes("/private") && !error.message.includes("secret"));
  }
});

test("public shares allow intentional name and fingerprint disclosure with sanitized errors", () => {
  const current = shared();
  current.entries[0]!.name = "review";
  current.entries[0]!.content.status = "collected";
  current.entries[0]!.content.digest = "b".repeat(64);
  current.errors = [{ code: "SOURCE_ERROR_REDACTED", scope: "source-capture" }];
  current.findings = [{ code: "SOURCE_FINDING_REDACTED", level: "unknown", entryIds: [] }];
  assert.deepEqual(parseSnapshot(current), current);
});
