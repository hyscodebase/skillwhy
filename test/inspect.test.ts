import test from "node:test";
import assert from "node:assert/strict";
import { inspectSnapshot, renderInspection } from "../src/inspect.js";
import type { InspectOptions } from "../src/inspect.js";
import type { Snapshot } from "../src/types.js";

function snapshot(): Snapshot {
  return {
    schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: "private-token-canary",
    capture: { host: "codex-cli", hostVersion: "0.158.0", adapterVersion: "0.1.0", surface: "fresh-cli-app-server", cwdAlias: "project", status: "complete", capturedAt: "2026-11-02T00:00:00.000Z", synthetic: false },
    coverage: { inventory: "complete-for-request", includedEntries: "all-returned", roots: "unknown", resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed" },
    rootMappings: [{ alias: "project", role: "project", userConfirmed: false }],
    entries: [{ entryId: "entry-0001", name: "review", label: "review-label", comparisonKey: "private-comparison-key", nativeScope: "repo", enabled: true, locationAlias: "project/review/SKILL.md", sourcePath: "/Users/private-canary/work/review/SKILL.md", content: { status: "collected", algorithm: "sha256", coverage: ["SKILL.md"], digest: "a".repeat(64) }, evidence: [{ field: "enabled", level: "observed", source: "skills/list", reference: "private-reference-canary" }] }],
    findings: [], errors: [],
  };
}

function share(): Snapshot {
  const current = snapshot();
  current.artifactKind = "share-v1";
  current.snapshotId = "share-test";
  current.capture.cwdAlias = "selected";
  current.coverage.includedEntries = "selected";
  current.rootMappings = [{ alias: "selected", role: "selected", userConfirmed: true }];
  const entry = current.entries[0]!;
  entry.entryId = "selected-entry";
  entry.name = null;
  entry.label = "public-review";
  entry.comparisonKey = "selected:public-review";
  entry.locationAlias = "selected/SKILL.md";
  delete entry.sourcePath;
  entry.content.status = "redacted";
  entry.content.digest = null;
  entry.evidence = [];
  return current;
}

test("inspection projects only actionable metadata and omits private canaries and digest values", () => {
  const current = snapshot();
  current.errors = [{ code: "INTERNAL_CANARY", scope: "/Users/error-canary/private" }];
  const inspection = inspectSnapshot(current);
  assert.deepEqual(inspection.entries[0], {
    entryId: "entry-0001", name: "review", label: "review-label", enabled: true, nativeScope: "repo", locationAlias: "project/review/SKILL.md", content: { status: "collected", digestPresent: true },
  });
  for (const output of [JSON.stringify(inspection), renderInspection(inspection)]) {
    for (const forbidden of ["/Users/", "private-canary", "error-canary", "private-token-canary", "private-comparison-key", "private-reference-canary", "INTERNAL_CANARY", "a".repeat(64), "sourcePath"]) assert.ok(!output.includes(forbidden), `Unexpected private field: ${forbidden}`);
  }
  assert.ok(inspection.notes.some(note => note.includes("Local inspection")));
  assert.ok(inspection.notes.some(note => note.includes("Capture evidence is incomplete")));
});

test("duplicate names preserve distinct entry IDs and returned order", () => {
  const current = snapshot();
  const duplicate = structuredClone(current.entries[0]!);
  duplicate.entryId = "entry-0002";
  duplicate.locationAlias = "project/another/SKILL.md";
  duplicate.enabled = false;
  current.entries.push(duplicate);
  const inspection = inspectSnapshot(current, { skill: "review" });
  assert.equal(inspection.filterMatch, "name");
  assert.equal(inspection.matchedEntries, 2);
  assert.deepEqual(inspection.entries.map(entry => entry.entryId), ["entry-0001", "entry-0002"]);
  assert.deepEqual(inspection.entries.map(entry => entry.enabled), [true, false]);
  assert.match(renderInspection(inspection), /entry-0002 · review/u);
});

test("private filters match exact names only and zero matches are an ordinary result", () => {
  for (const skill of ["Review", "rev", "review-label", "missing"]) {
    const inspection = inspectSnapshot(snapshot(), { skill });
    assert.equal(inspection.filterMatch, "none");
    assert.equal(inspection.matchedEntries, 0);
    assert.equal(inspection.totalEntries, 1);
    assert.deepEqual(inspection.entries, []);
    assert.ok(inspection.notes.some(note => note.includes("does not prove that the skill is absent")));
  }
});

test("selected shares explicitly report subset coverage and support a public label fallback", () => {
  const inspection = inspectSnapshot(share(), { skill: "public-review" });
  assert.equal(inspection.artifactKind, "share-v1");
  assert.equal(inspection.includedEntries, "selected");
  assert.equal(inspection.filterMatch, "share-label");
  assert.equal(inspection.matchedEntries, 1);
  assert.equal(inspection.entries[0]!.name, null);
  assert.equal(inspection.entries[0]!.content.digestPresent, false);
  assert.ok(inspection.notes.some(note => note.includes("Selected subset")));
  assert.ok(inspection.notes.some(note => note.includes("first matches the exact name")));
  assert.match(renderInspection(inspection), /selected-entry · public-review/u);
});

test("selected shares prefer a name match and can also find an independently named public label", () => {
  const current = share();
  current.entries[0]!.name = "real-review";
  assert.equal(inspectSnapshot(current, { skill: "real-review" }).filterMatch, "name");
  assert.equal(inspectSnapshot(current, { skill: "public-review" }).filterMatch, "share-label");
  current.entries[0]!.name = "public-review";
  assert.equal(inspectSnapshot(current, { skill: "public-review" }).filterMatch, "name");
});

test("content status and unknown enabled values remain explicit without fabricating a digest", () => {
  const current = snapshot();
  current.entries[0]!.enabled = null;
  current.entries[0]!.nativeScope = null;
  current.entries[0]!.content.status = "unreadable";
  current.entries[0]!.content.digest = null;
  const inspection = inspectSnapshot(current);
  assert.equal(inspection.entries[0]!.enabled, null);
  assert.deepEqual(inspection.entries[0]!.content, { status: "unreadable", digestPresent: false });
  assert.match(renderInspection(inspection), /enabled: unknown · native scope: unknown/u);
});

test("terminal controls and bidi controls are sanitized in both JSON projections and text", () => {
  const current = snapshot();
  current.entries[0]!.name = "re\u009b31mview\u202e";
  current.entries[0]!.label = "la\u2066bel";
  const inspection = inspectSnapshot(current);
  for (const output of [JSON.stringify(inspection), ...renderInspection(inspection).split("\n")]) assert.doesNotMatch(output, /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u);
  assert.ok(inspection.notes.some(note => note.includes("sanitized")));
  assert.equal(inspection.entries[0]!.entryId, "entry-0001");
});

test("absolute-path-shaped allowed fields are redacted and the semantic change is disclosed", () => {
  const paths = ["/Users/private-canary/SKILL.md", "C:\\Users\\private-canary\\SKILL.md", "\\\\server\\private-canary\\SKILL.md", "file:///Users/private-canary/SKILL.md", "diagnostic=/Users/private-canary/SKILL.md", "~/private-canary/SKILL.md"];
  for (const path of paths) {
    const current = snapshot();
    current.entries[0]!.name = path;
    current.entries[0]!.label = path;
    current.entries[0]!.locationAlias = path;
    current.entries[0]!.nativeScope = path;
    const inspection = inspectSnapshot(current);
    assert.equal(inspection.entries[0]!.name, "[redacted-path]");
    assert.equal(inspection.entries[0]!.locationAlias, "[redacted-path]");
    assert.ok(inspection.notes.some(note => note.includes("Displayed values may differ")));
    assert.ok(!JSON.stringify(inspection).includes("private-canary"));
    assert.ok(!renderInspection(inspection).includes("private-canary"));
  }
});

test("inspection rejects malformed snapshots and invalid options with safe messages", () => {
  const invalid = snapshot();
  (invalid.entries[0] as unknown as Record<string, unknown>).secret_token = "private-canary";
  assert.throws(() => inspectSnapshot(invalid), error => error instanceof Error && !error.message.includes("private-canary") && !error.message.includes("secret_token"));
  for (const options of [{ skill: "" }, { skill: 42 }, null, [], { skill: "x".repeat(257) }, { extra: "private-canary" }]) {
    assert.throws(() => inspectSnapshot(snapshot(), options as InspectOptions), error => error instanceof Error && !error.message.includes("private-canary"));
  }
});

test("inspection is a detached projection and does not mutate its input", () => {
  const current = snapshot();
  const before = structuredClone(current);
  const inspection = inspectSnapshot(current);
  inspection.entries[0]!.label = "changed";
  inspection.entries[0]!.content.digestPresent = false;
  assert.deepEqual(current, before);
});

test("synthetic and empty inventories are clearly reported without claiming absence", () => {
  const current = snapshot();
  current.capture.synthetic = true;
  current.entries = [];
  const inspection = inspectSnapshot(current);
  assert.equal(inspection.totalEntries, 0);
  assert.equal(inspection.matchedEntries, 0);
  assert.equal(inspection.filterMatch, "unfiltered");
  const rendered = renderInspection(inspection);
  assert.match(rendered, /SYNTHETIC EXAMPLE — NOT A LIVE SCAN/u);
  assert.match(rendered, /No entries to display in this stored selection/u);
});
