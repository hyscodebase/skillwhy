import type { Snapshot, SkillEntry } from "./types.js";

function entry(enabled: boolean): SkillEntry {
  return {
    entryId: "demo-entry", name: "release-review", label: "release-review",
    comparisonKey: "demo:release-review", nativeScope: "repo", enabled,
    locationAlias: "project/.agents/skills/release-review/SKILL.md",
    content: { status: "collected", algorithm: "sha256", coverage: ["SKILL.md"], digest: "a".repeat(64) },
    evidence: [{ field: "enabled", level: "observed", source: "skills/list", reference: "synthetic-fixture" }],
  };
}

export function demoSnapshots(): [Snapshot, Snapshot] {
  const base: Snapshot = {
    schemaVersion: 1, artifactKind: "private-snapshot", snapshotId: "synthetic-maintainer",
    capture: { host: "codex-cli", hostVersion: "0.166.0", adapterVersion: "0.1.0-alpha.1", surface: "fresh-cli-app-server", cwdAlias: "project", status: "complete", capturedAt: "2026-11-02T00:00:00.000Z", synthetic: true },
    coverage: { inventory: "complete-for-request", includedEntries: "all-returned", roots: "known", resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed" },
    rootMappings: [{ alias: "project", role: "project", userConfirmed: true }],
    entries: [entry(true)], findings: [], errors: [],
  };
  return [base, { ...structuredClone(base), snapshotId: "synthetic-user", entries: [entry(false)] }];
}
