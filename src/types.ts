export type EvidenceLevel = "observed" | "inferred" | "unknown";
export type CaptureStatus = "complete" | "partial" | "unsupported" | "error";
export interface Evidence {
  field: string;
  level: EvidenceLevel;
  source: "skills/list" | "filesystem" | "user-mapping";
  reference: string;
}
export interface SkillEntry {
  entryId: string;
  name: string | null;
  label: string;
  comparisonKey: string | null;
  nativeScope: string | null;
  enabled: boolean | null;
  locationAlias: string;
  sourcePath?: string;
  content: {
    status: "collected" | "not-requested" | "outside-scope" | "nonlocal" | "unreadable" | "changed-during-read" | "redacted";
    algorithm: "sha256";
    coverage: ["SKILL.md"];
    digest: string | null;
  };
  evidence: Evidence[];
}
export interface Snapshot {
  schemaVersion: 1;
  artifactKind: "private-snapshot" | "share-v1";
  snapshotId: string;
  capture: {
    host: "codex-cli";
    hostVersion: string;
    adapterVersion: string;
    surface: "fresh-cli-app-server";
    cwdAlias: string;
    status: CaptureStatus;
    capturedAt: string;
    synthetic: boolean;
  };
  coverage: {
    inventory: "complete-for-request" | "partial" | "unknown";
    includedEntries: "all-returned" | "selected";
    roots: "known" | "partial" | "unknown";
    resources: "not-collected";
    activeDesktop: "not-observed";
    loadedOrExecuted: "not-observed";
  };
  rootMappings: { alias: string; role: string; userConfirmed: boolean }[];
  entries: SkillEntry[];
  findings: { code: string; level: EvidenceLevel; entryIds: string[] }[];
  errors: { code: string; scope: string }[];
}
export interface Difference {
  kind: "added" | "not-returned" | "enabled-changed" | "content-changed" | "name-changed" | "scope-changed" | "multiplicity-changed" | "coverage-changed" | "host-version-changed" | "unknown" | "ambiguous-match";
  key: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  evidence: EvidenceLevel;
  explanation: string;
}
export interface Comparison {
  status: "complete" | "inconclusive";
  synthetic: boolean;
  differences: Difference[];
  comparedEntries: number;
  notes: string[];
}
export interface CompareOptions {
  /** Explicitly confirmed alias mapping from left to right. */
  rootMap?: Record<string, string>;
}
export interface CaptureOptions {
  cwd: string;
  codexBin?: string;
  timeoutMs?: number;
  digest?: boolean;
}
export interface ShareOptions {
  entryIds: string[];
  alias: string;
  includeName?: boolean;
  includeDigest?: boolean;
}
