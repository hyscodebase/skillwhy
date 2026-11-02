import test from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots } from "../src/compare.js";
import type { SkillEntry, Snapshot } from "../src/types.js";

function entry(id: string, location = "project/tools/review/SKILL.md"): SkillEntry {
  return { entryId: id, name: "review", label: "review", comparisonKey: null, nativeScope: "repo", enabled: true, locationAlias: location, content: { status: "collected", algorithm: "sha256", coverage: ["SKILL.md"], digest: "a".repeat(64) }, evidence: [] };
}

function snapshot(entries = [entry("one")]): Snapshot {
  return { schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: "test", capture: { host: "codex-cli", hostVersion: "0.158.0", adapterVersion: "0.1.0", surface: "fresh-cli-app-server", cwdAlias: "project", status: "complete", capturedAt: "2026-11-02T00:00:00.000Z", synthetic: false }, coverage: { inventory: "complete-for-request", includedEntries: "all-returned", roots: "known", resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed" }, rootMappings: [{ alias: "project", role: "project", userConfirmed: true }], entries, findings: [], errors: [] };
}

const mapped = { rootMap: { project: "project" } };

test("same names, aliases and confirmed roles never create an implicit association", () => {
  const result = compareSnapshots(snapshot(), snapshot());
  assert.equal(result.comparedEntries, 0);
  assert.equal(result.status, "inconclusive");
  assert.equal(result.differences.length, 2);
  assert.ok(result.differences.every(difference => difference.kind === "unknown"));
});

test("explicit root association matches relative paths, without requiring equal names", () => {
  const left = snapshot();
  const right = snapshot([entry("new-id", "workspace/tools/review/SKILL.md")]);
  right.rootMappings = [{ alias: "workspace", role: "different-role", userConfirmed: false }];
  right.entries[0]!.name = "renamed-review";
  right.entries[0]!.enabled = false;
  const result = compareSnapshots(left, right, { rootMap: { project: "workspace" } });
  assert.equal(result.status, "complete");
  assert.equal(result.comparedEntries, 1);
  assert.deepEqual(result.differences.map(difference => difference.kind), ["enabled-changed", "name-changed"]);
});

test("two same-named skills at different mapped paths remain separate entries", () => {
  const left = snapshot([entry("first", "project/a/SKILL.md"), entry("second", "project/b/SKILL.md")]);
  const right = structuredClone(left);
  right.entries.reverse();
  right.entries[0]!.enabled = false;
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.comparedEntries, 2);
  assert.deepEqual(result.differences.map(difference => difference.kind), ["enabled-changed"]);
  assert.match(result.differences[0]!.key, /\/b\/SKILL\.md/u);
});

test("duplicate explicit identities produce ambiguity and never pair by order", () => {
  const left = snapshot([entry("first"), entry("second")]);
  const right = snapshot();
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.comparedEntries, 0);
  assert.equal(result.status, "inconclusive");
  assert.deepEqual(result.differences.map(difference => difference.kind), ["multiplicity-changed", "ambiguous-match"]);
  assert.ok(!result.differences.some(difference => difference.kind === "enabled-changed"));
});

test("duplicate explicit comparison keys cannot silently select a winning copy", () => {
  const left = snapshot([entry("one"), entry("two", "project/other/SKILL.md")]);
  const right = snapshot();
  for (const item of [...left.entries, ...right.entries]) item.comparisonKey = "approved-review";
  const result = compareSnapshots(left, right);
  assert.equal(result.status, "inconclusive");
  assert.ok(result.differences.some(difference => difference.kind === "ambiguous-match"));
});

test("partial captures never turn an unreturned entry into a removal or addition", () => {
  for (const side of ["left", "right"] as const) {
    const left = snapshot();
    const right = snapshot([]);
    const partial = side === "left" ? left : right;
    partial.capture.status = "partial";
    partial.coverage.inventory = "partial";
    const result = compareSnapshots(left, right, mapped);
    assert.equal(result.status, "inconclusive");
    assert.ok(result.differences.some(difference => difference.kind === "unknown"));
    assert.ok(!result.differences.some(difference => difference.kind === "added" || difference.kind === "not-returned"));
  }
});

test("complete inventory with unknown roots does not establish scoped absence", () => {
  const left = snapshot();
  const right = snapshot([]);
  right.coverage.roots = "unknown";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.status, "inconclusive");
  assert.ok(!result.differences.some(difference => difference.kind === "not-returned"));
});

test("known full mapped inventories can report scoped non-return, without causal claims", () => {
  const result = compareSnapshots(snapshot(), snapshot([]), mapped);
  assert.equal(result.status, "complete");
  assert.equal(result.differences[0]!.kind, "not-returned");
  assert.match(result.differences[0]!.explanation, /not proof of deletion/u);
  const reverse = compareSnapshots(snapshot([]), snapshot(), mapped);
  assert.equal(reverse.differences[0]!.kind, "added");
});

test("selected shares compare an explicit key without asserting omitted inventory", () => {
  const left = snapshot();
  const right = snapshot();
  for (const current of [left, right]) {
    current.artifactKind = "share-v1";
    current.coverage.includedEntries = "selected";
    current.coverage.roots = "unknown";
    current.entries[0]!.comparisonKey = "selected:review";
    current.entries[0]!.name = null;
    current.entries[0]!.content.status = "redacted";
    current.entries[0]!.content.digest = null;
  }
  right.entries[0]!.enabled = false;
  const result = compareSnapshots(left, right);
  assert.equal(result.status, "complete");
  assert.equal(result.comparedEntries, 1);
  assert.equal(result.differences[0]!.kind, "enabled-changed");
  assert.ok(result.notes.some(note => note.includes("Missing fingerprints do not establish equal contents")));
  assert.ok(result.notes.some(note => note.includes("Omitted entries are unknown")));
  right.entries = [];
  const omitted = compareSnapshots(left, right, mapped);
  assert.equal(omitted.status, "inconclusive");
  assert.ok(!omitted.differences.some(difference => difference.kind === "not-returned"));
});

test("unknown roots still permit a bounded comparison of positively mapped entries", () => {
  const left = snapshot();
  const right = snapshot();
  left.coverage.roots = right.coverage.roots = "unknown";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.status, "complete");
  assert.equal(result.comparedEntries, 1);
  assert.equal(result.differences.length, 0);
  assert.ok(result.notes.some(note => note.includes("not fully established")));
});

test("unavailable content is unknown, while deliberately omitted content is explicitly unassessed", () => {
  const left = snapshot();
  const right = snapshot();
  for (const current of [left, right]) {
    current.entries[0]!.content.status = "unreadable";
    current.entries[0]!.content.digest = null;
  }
  const failed = compareSnapshots(left, right, mapped);
  assert.equal(failed.status, "inconclusive");
  assert.equal(failed.differences[0]!.kind, "unknown");
  for (const current of [left, right]) current.entries[0]!.content.status = "not-requested";
  const omitted = compareSnapshots(left, right, mapped);
  assert.equal(omitted.status, "complete");
  assert.ok(omitted.notes.some(note => note.includes("contents were not compared")));
});

test("hash comparison is case insensitive and different hashes are limited to SKILL.md", () => {
  const left = snapshot();
  const right = snapshot();
  right.entries[0]!.content.digest = "A".repeat(64);
  assert.equal(compareSnapshots(left, right, mapped).differences.length, 0);
  right.entries[0]!.content.digest = "b".repeat(64);
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.differences[0]!.kind, "content-changed");
  assert.match(result.differences[0]!.explanation, /runtime behavior were not compared/u);
});

test("unknown enabled values are not considered equal", () => {
  const left = snapshot();
  const right = snapshot();
  left.entries[0]!.enabled = right.entries[0]!.enabled = null;
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.status, "inconclusive");
  assert.equal(result.differences[0]!.kind, "unknown");
});

test("host version changes are descriptive, and synthetic provenance is preserved", () => {
  const left = snapshot();
  const right = snapshot();
  right.capture.hostVersion = "0.159.0";
  left.capture.synthetic = true;
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.synthetic, true);
  assert.equal(result.differences[0]!.kind, "host-version-changed");
  assert.match(result.differences[0]!.explanation, /does not establish the cause/u);
});

test("unknown aliases and many-to-one root mappings are rejected without reflecting input", () => {
  assert.throws(() => compareSnapshots(snapshot(), snapshot(), { rootMap: { secret_path: "project" } }), error => error instanceof Error && !error.message.includes("secret_path"));
  const left = snapshot();
  left.rootMappings.push({ alias: "second", role: "other", userConfirmed: false });
  assert.throws(() => compareSnapshots(left, snapshot(), { rootMap: { project: "project", second: "project" } }), /one-to-one/u);
});

test("prefix matching respects alias boundaries and the most specific mapped root", () => {
  const left = snapshot([entry("one", "project-elsewhere/a/SKILL.md")]);
  const right = structuredClone(left);
  assert.equal(compareSnapshots(left, right, mapped).comparedEntries, 0);
  left.entries[0]!.locationAlias = right.entries[0]!.locationAlias = "project/nested/a/SKILL.md";
  for (const current of [left, right]) current.rootMappings.push({ alias: "project/nested", role: "nested", userConfirmed: false });
  const result = compareSnapshots(left, right, { rootMap: { project: "project", "project/nested": "project/nested" } });
  assert.equal(result.comparedEntries, 1);
});

test("explicit keys do not fall back to path matching when the identities differ", () => {
  const left = snapshot();
  const right = snapshot();
  left.entries[0]!.comparisonKey = "first-explicit";
  right.entries[0]!.comparisonKey = "second-explicit";
  left.coverage.roots = right.coverage.roots = "unknown";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.comparedEntries, 0);
  assert.equal(result.status, "inconclusive");
});

test("empty lists do not imply whole-environment equivalence", () => {
  const result = compareSnapshots(snapshot([]), snapshot([]));
  assert.equal(result.status, "inconclusive");
  assert.equal(result.differences[0]!.kind, "unknown");
  const scoped = compareSnapshots(snapshot([]), snapshot([]), mapped);
  assert.equal(scoped.status, "complete");
  assert.equal(scoped.comparedEntries, 0);
});

test("mixed private snapshots and selected shares are rejected", () => {
  const left = snapshot();
  const right = snapshot();
  right.artifactKind = "share-v1";
  assert.throws(() => compareSnapshots(left, right), /same kind/u);
  assert.throws(() => compareSnapshots(right, left), /same kind/u);
});

test("explicit root maps select scope and exclude unrelated global entries without guessing", () => {
  const left = snapshot([entry("project"), entry("global-a", "external-001/SKILL.md")]);
  const right = snapshot([entry("project"), entry("global-b", "external-002/SKILL.md"), entry("global-c", "external-003/SKILL.md")]);
  left.coverage.roots = right.coverage.roots = "unknown";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.status, "complete");
  assert.equal(result.comparedEntries, 1);
  assert.equal(result.differences.length, 0);
  assert.ok(result.notes.some(note => note.startsWith("left: 1 entries outside")));
  assert.ok(result.notes.some(note => note.startsWith("right: 2 entries outside")));
  assert.ok(result.notes.some(note => note.includes("Their presence, absence, and equality were not assessed")));
  // Inputs retain all copies; scope filtering only affects this comparison.
  assert.equal(left.entries.length, 2);
  assert.equal(right.entries.length, 3);
});

test("an empty selected root with unknown coverage remains inconclusive", () => {
  const left = snapshot([entry("global", "external-001/SKILL.md")]);
  const right = snapshot([entry("global", "external-001/SKILL.md")]);
  left.coverage.roots = right.coverage.roots = "unknown";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.comparedEntries, 0);
  assert.equal(result.status, "inconclusive");
  assert.equal(result.differences[0]!.kind, "unknown");
});

test("explicit entry keys are retained even when outside a selected root mapping", () => {
  const left = snapshot([entry("global", "external-001/SKILL.md")]);
  const right = snapshot([entry("global", "external-002/SKILL.md")]);
  left.entries[0]!.comparisonKey = right.entries[0]!.comparisonKey = "confirmed-global-entry";
  const result = compareSnapshots(left, right, mapped);
  assert.equal(result.comparedEntries, 1);
  assert.equal(result.status, "complete");
});

test("scope and name changes are observed metadata differences, never precedence claims", () => {
  const left = snapshot();
  const right = snapshot();
  right.entries[0]!.name = "review-new";
  right.entries[0]!.nativeScope = "user";
  const result = compareSnapshots(left, right, mapped);
  assert.deepEqual(result.differences.map(difference => difference.kind), ["name-changed", "scope-changed"]);
  assert.ok(result.differences.every(difference => difference.evidence === "observed"));
  assert.match(result.differences[1]!.explanation, /No scope precedence/u);
  right.entries[0]!.name = null;
  right.entries[0]!.nativeScope = null;
  const unavailable = compareSnapshots(left, right, mapped);
  assert.equal(unavailable.differences.length, 0);
  assert.ok(unavailable.notes.some(note => note.includes("Some names were omitted")));
  assert.ok(unavailable.notes.some(note => note.includes("Some native scope labels are unavailable")));
});

test("a declared nested root is excluded unless explicitly mapped, even when its parent is mapped", () => {
  const left = snapshot([entry("parent", "project/a/SKILL.md"), entry("nested", "project/nested/b/SKILL.md")]);
  const right = structuredClone(left);
  for (const current of [left, right]) {
    current.coverage.roots = "unknown";
    current.rootMappings.push({ alias: "project/nested", role: "nested", userConfirmed: false });
  }
  right.entries[1]!.enabled = false;
  const parentOnly = compareSnapshots(left, right, mapped);
  assert.equal(parentOnly.status, "complete");
  assert.equal(parentOnly.comparedEntries, 1);
  assert.equal(parentOnly.differences.length, 0);
  assert.ok(parentOnly.notes.some(note => note.startsWith("left: 1 entries outside")));
  assert.ok(parentOnly.notes.some(note => note.startsWith("right: 1 entries outside")));
  const nestedIncluded = compareSnapshots(left, right, { rootMap: { project: "project", "project/nested": "project/nested" } });
  assert.equal(nestedIncluded.comparedEntries, 2);
  assert.deepEqual(nestedIncluded.differences.map(difference => difference.kind), ["enabled-changed"]);
});
