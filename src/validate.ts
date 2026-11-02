import type { Snapshot } from "./types.js";

const MAX_ITEMS = 10_000;
const CONTENT_STATUSES = ["collected", "not-requested", "outside-scope", "nonlocal", "unreadable", "changed-during-read", "redacted"] as const;
const LEVELS = ["observed", "inferred", "unknown"] as const;

function invalid(path: string): never {
  // Paths contain only schema field names and numeric indices, never user values.
  throw new Error(`Invalid snapshot at ${path}.`);
}

function object(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(path);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(path);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== "string" || (!required.includes(key) && !optional.includes(key)))) invalid(path);
  for (const key of required) if (!Object.hasOwn(descriptors, key)) invalid(path);
  for (const descriptor of Object.values(descriptors)) {
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) invalid(path);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, max = 4096): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) invalid(path);
}

function nullableText(value: unknown, path: string, max = 4096): void {
  if (value !== null) text(value, path, max);
}

function choice(value: unknown, path: string, choices: readonly unknown[]): void {
  if (!choices.includes(value)) invalid(path);
}

function array(value: unknown, path: string, max = MAX_ITEMS): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path);
  if (Object.getPrototypeOf(value) !== Array.prototype) invalid(path);
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length) invalid(path);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) invalid(path);
  }
  // Sparse arrays are not JSON arrays and must not silently skip validation.
  for (let i = 0; i < value.length; i += 1) if (!Object.hasOwn(value, i)) invalid(path);
  return value;
}

function code(value: unknown, path: string): void {
  text(value, path, 128);
  if (!/^[A-Za-z0-9_.:-]+$/u.test(value)) invalid(path);
}

function publicVersion(value: unknown, path: string): void {
  if (typeof value !== "string" || !/^(?:unknown|\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)(?:[.-]?\d+)?)?)$/u.test(value)) invalid(path);
}

/** Strict, bounded JSON validation. Error messages never echo submitted values. */
export function parseSnapshot(value: unknown): Snapshot {
  const root = object(value, "snapshot", ["schemaVersion", "artifactKind", "snapshotId", "capture", "coverage", "rootMappings", "entries", "findings", "errors"]);
  choice(root.schemaVersion, "schemaVersion", [1]);
  choice(root.artifactKind, "artifactKind", ["private-snapshot", "share-v1"]);
  const publicShare = root.artifactKind === "share-v1";
  text(root.snapshotId, "snapshotId", 128);
  const capture = object(root.capture, "capture", ["host", "hostVersion", "adapterVersion", "surface", "cwdAlias", "status", "capturedAt", "synthetic"]);
  choice(capture.host, "capture.host", ["codex-cli"]);
  choice(capture.surface, "capture.surface", ["fresh-cli-app-server"]);
  text(capture.hostVersion, "capture.hostVersion", 128);
  text(capture.adapterVersion, "capture.adapterVersion", 128);
  text(capture.cwdAlias, "capture.cwdAlias", 1024);
  choice(capture.status, "capture.status", ["complete", "partial", "unsupported", "error"]);
  choice(capture.synthetic, "capture.synthetic", [true, false]);
  text(capture.capturedAt, "capture.capturedAt", 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(capture.capturedAt) || !Number.isFinite(Date.parse(capture.capturedAt))) invalid("capture.capturedAt");
  const normalizedTimestamp = `${capture.capturedAt.slice(0, 19)}.${(capture.capturedAt.match(/\.(\d{1,3})Z$/u)?.[1] ?? "").padEnd(3, "0")}Z`;
  if (new Date(capture.capturedAt).toISOString() !== normalizedTimestamp) invalid("capture.capturedAt");

  const coverage = object(root.coverage, "coverage", ["inventory", "includedEntries", "roots", "resources", "activeDesktop", "loadedOrExecuted"]);
  choice(coverage.inventory, "coverage.inventory", ["complete-for-request", "partial", "unknown"]);
  choice(coverage.includedEntries, "coverage.includedEntries", ["all-returned", "selected"]);
  choice(coverage.roots, "coverage.roots", ["known", "partial", "unknown"]);
  choice(coverage.resources, "coverage.resources", ["not-collected"]);
  choice(coverage.activeDesktop, "coverage.activeDesktop", ["not-observed"]);
  choice(coverage.loadedOrExecuted, "coverage.loadedOrExecuted", ["not-observed"]);

  const mappings = array(root.rootMappings, "rootMappings");
  const aliases = new Set<string>();
  mappings.forEach((item, index) => {
    const path = `rootMappings[${index}]`;
    const mapping = object(item, path, ["alias", "role", "userConfirmed"]);
    text(mapping.alias, `${path}.alias`, 1024);
    text(mapping.role, `${path}.role`, 128);
    choice(mapping.userConfirmed, `${path}.userConfirmed`, [true, false]);
    if (aliases.has(mapping.alias)) invalid(`${path}.alias`);
    aliases.add(mapping.alias);
  });

  const entries = array(root.entries, "entries");
  const ids = new Set<string>();
  entries.forEach((item, index) => {
    const path = `entries[${index}]`;
    const entry = object(item, path, ["entryId", "name", "label", "comparisonKey", "nativeScope", "enabled", "locationAlias", "content", "evidence"], publicShare ? [] : ["sourcePath"]);
    text(entry.entryId, `${path}.entryId`, 128);
    if (ids.has(entry.entryId)) invalid(`${path}.entryId`);
    ids.add(entry.entryId);
    nullableText(entry.name, `${path}.name`, 256);
    text(entry.label, `${path}.label`, 256);
    nullableText(entry.comparisonKey, `${path}.comparisonKey`, 1024);
    nullableText(entry.nativeScope, `${path}.nativeScope`, 128);
    choice(entry.enabled, `${path}.enabled`, [true, false, null]);
    text(entry.locationAlias, `${path}.locationAlias`, 4096);
    if (Object.hasOwn(entry, "sourcePath")) text(entry.sourcePath, `${path}.sourcePath`, 4096);
    const content = object(entry.content, `${path}.content`, ["status", "algorithm", "coverage", "digest"]);
    choice(content.status, `${path}.content.status`, CONTENT_STATUSES);
    choice(content.algorithm, `${path}.content.algorithm`, ["sha256"]);
    const digestCoverage = array(content.coverage, `${path}.content.coverage`, 1);
    if (digestCoverage.length !== 1 || digestCoverage[0] !== "SKILL.md") invalid(`${path}.content.coverage`);
    if (content.status === "collected") {
      if (typeof content.digest !== "string" || !/^[a-f0-9]{64}$/iu.test(content.digest)) invalid(`${path}.content.digest`);
    } else if (content.digest !== null) invalid(`${path}.content.digest`);
    const evidence = array(entry.evidence, `${path}.evidence`, 100);
    evidence.forEach((itemEvidence, evidenceIndex) => {
      const evidencePath = `${path}.evidence[${evidenceIndex}]`;
      const record = object(itemEvidence, evidencePath, ["field", "level", "source", "reference"]);
      code(record.field, `${evidencePath}.field`);
      choice(record.level, `${evidencePath}.level`, LEVELS);
      choice(record.source, `${evidencePath}.source`, ["skills/list", "filesystem", "user-mapping"]);
      text(record.reference, `${evidencePath}.reference`, 2048);
      if (publicShare) {
        choice(record.field, `${evidencePath}.field`, ["comparisonKey", "enabled", "nativeScope", "digest"]);
        choice(record.reference, `${evidencePath}.reference`, ["explicit-selection", "selected-entry"]);
      }
    });
    if (publicShare) {
      choice(entry.entryId, `${path}.entryId`, ["selected-entry"]);
      choice(entry.locationAlias, `${path}.locationAlias`, ["selected/SKILL.md"]);
      choice(entry.nativeScope, `${path}.nativeScope`, ["repo", "user", "admin", "system", null]);
      if (!/^[A-Za-z0-9_-]{1,64}$/u.test(entry.label) || entry.comparisonKey !== `selected:${entry.label}`) invalid(`${path}.comparisonKey`);
    }
  });

  array(root.findings, "findings").forEach((item, index) => {
    const path = `findings[${index}]`;
    const finding = object(item, path, ["code", "level", "entryIds"]);
    code(finding.code, `${path}.code`);
    choice(finding.level, `${path}.level`, LEVELS);
    const entryIds = array(finding.entryIds, `${path}.entryIds`);
    entryIds.forEach((id, idIndex) => {
      text(id, `${path}.entryIds[${idIndex}]`, 128);
      if (!ids.has(id)) invalid(`${path}.entryIds[${idIndex}]`);
    });
    if (publicShare && (finding.code !== "SOURCE_FINDING_REDACTED" || entryIds.length !== 0)) invalid(path);
  });
  array(root.errors, "errors").forEach((item, index) => {
    const path = `errors[${index}]`;
    const error = object(item, path, ["code", "scope"]);
    code(error.code, `${path}.code`);
    text(error.scope, `${path}.scope`, 1024);
    if (publicShare && (error.code !== "SOURCE_ERROR_REDACTED" || error.scope !== "source-capture")) invalid(path);
  });

  if (publicShare) {
    if (!/^share-[A-Za-z0-9-]+$/u.test(root.snapshotId)) invalid("snapshotId");
    publicVersion(capture.hostVersion, "capture.hostVersion");
    publicVersion(capture.adapterVersion, "capture.adapterVersion");
    if (capture.cwdAlias !== "selected" || coverage.includedEntries !== "selected" || entries.length !== 1 || mappings.length !== 1) invalid("share-v1");
    const mapping = mappings[0] as Record<string, unknown>;
    if (mapping.alias !== "selected" || mapping.role !== "selected" || mapping.userConfirmed !== true) invalid("rootMappings");
  }
  return value as Snapshot;
}
