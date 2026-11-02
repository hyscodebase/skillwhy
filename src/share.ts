import { randomUUID } from "node:crypto";
import type { Evidence, ShareOptions, SkillEntry, Snapshot } from "./types.js";

const PUBLIC_ALIAS = /^[A-Za-z0-9_-]{1,64}$/;
const PUBLIC_VERSION = /^(?:codex-cli )?\d{1,4}\.\d{1,4}\.\d{1,4}(?:-(?:alpha|beta|rc)(?:[.-]\d{1,4})?)?$/;
const PUBLIC_SCOPES = new Set(["repo", "user", "admin", "system"]);
const EVIDENCE_FIELDS = new Set(["enabled", "nativeScope", "digest"]);

function safeVersion(value: string): string {
  return PUBLIC_VERSION.test(value) ? value.replace(/^codex-cli /, "") : "unknown";
}

function safeTimestamp(value: string): string {
  // Re-serialization prevents an otherwise valid timestamp field carrying prose.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error("Snapshot capture timestamp is invalid.");
  }
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Snapshot capture timestamp is invalid.");
  return timestamp.toISOString();
}

/** Build a minimal artifact from an allowlist; no original object is copied. */
export function createShareBundle(snapshot: Snapshot, options: ShareOptions): Snapshot {
  if (!PUBLIC_ALIAS.test(options.alias)) {
    throw new Error("A public alias of 1–64 ASCII letters, numbers, underscores or hyphens is required.");
  }
  if (!Array.isArray(options.entryIds) || options.entryIds.length !== 1) {
    throw new Error("Select exactly one entry for a v0.1 share bundle.");
  }
  const matches = snapshot.entries.filter((entry) => entry.entryId === options.entryIds[0]);
  if (matches.length !== 1) {
    throw new Error("The selected entry must exist exactly once in the snapshot.");
  }
  const entry = matches[0]!;
  const nativeScope = entry.nativeScope !== null && PUBLIC_SCOPES.has(entry.nativeScope)
    ? entry.nativeScope : null;
  const includeDigest = options.includeDigest === true;
  const evidence: Evidence[] = [{
    field: "comparisonKey", level: "observed", source: "user-mapping", reference: "explicit-selection",
  }];
  for (const item of entry.evidence) {
    const field = item.field === "content.digest" ? "digest" : item.field;
    if (!EVIDENCE_FIELDS.has(field)) continue;
    if (field === "digest" && !includeDigest) continue;
    if (field === "nativeScope" && nativeScope === null) continue;
    evidence.push({ field, level: item.level, source: item.source, reference: "selected-entry" });
  }
  const publicEntry: SkillEntry = {
    entryId: "selected-entry",
    name: options.includeName === true ? entry.name : null,
    label: options.alias,
    comparisonKey: `selected:${options.alias}`,
    nativeScope,
    enabled: entry.enabled,
    locationAlias: "selected/SKILL.md",
    content: {
      status: includeDigest ? entry.content.status : "redacted",
      algorithm: "sha256",
      coverage: ["SKILL.md"],
      digest: includeDigest ? entry.content.digest : null,
    },
    evidence,
  };
  return {
    schemaVersion: 1,
    artifactKind: "share-v1",
    snapshotId: `share-${randomUUID()}`,
    capture: {
      host: "codex-cli",
      hostVersion: safeVersion(snapshot.capture.hostVersion),
      adapterVersion: safeVersion(snapshot.capture.adapterVersion),
      surface: "fresh-cli-app-server",
      cwdAlias: "selected",
      status: snapshot.capture.status,
      capturedAt: safeTimestamp(snapshot.capture.capturedAt),
      synthetic: snapshot.capture.synthetic,
    },
    coverage: {
      inventory: snapshot.coverage.inventory,
      includedEntries: "selected",
      roots: snapshot.coverage.roots,
      resources: "not-collected",
      activeDesktop: "not-observed",
      loadedOrExecuted: "not-observed",
    },
    rootMappings: [{ alias: "selected", role: "selected", userConfirmed: true }],
    entries: [publicEntry],
    // Preserve the existence and uncertainty of findings, not their raw text or associations.
    findings: snapshot.findings.map((finding) => ({
      code: "SOURCE_FINDING_REDACTED", level: finding.level, entryIds: [],
    })),
    errors: snapshot.errors.map(() => ({ code: "SOURCE_ERROR_REDACTED", scope: "source-capture" })),
  };
}
