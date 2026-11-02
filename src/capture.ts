import { constants } from "node:fs";
import { access, lstat, open, realpath, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, delimiter, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import type { CaptureOptions, SkillEntry, Snapshot } from "./types.js";
import { CaptureFailure, isRecord, probeVersion, querySkills } from "./protocol.js";

export const SUPPORTED_CODEX_VERSION = "0.166.0";
export const ADAPTER_VERSION = "0.1.0-alpha.1";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
// Keep room for the project root if every returned entry has a different external root.
const MAX_ENTRIES = 9_999;
const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 4096;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function baseSnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    artifactKind: "private-snapshot",
    snapshotId: randomUUID(),
    capture: { host: "codex-cli", hostVersion: "unknown", adapterVersion: ADAPTER_VERSION,
      surface: "fresh-cli-app-server", cwdAlias: "project", status: "error",
      capturedAt: new Date().toISOString(), synthetic: false },
    coverage: { inventory: "unknown", includedEntries: "all-returned", roots: "unknown",
      resources: "not-collected", activeDesktop: "not-observed", loadedOrExecuted: "not-observed" },
    rootMappings: [{ alias: "project", role: "project", userConfirmed: false }],
    entries: [], findings: [], errors: [],
  };
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function projectLocation(cwd: string, path: string): string | null {
  if (!isAbsolute(path) || !inside(cwd, normalize(path))) return null;
  return "project/" + relative(cwd, normalize(path)).split(sep).join("/");
}

async function executablePath(binary: string): Promise<string> {
  const candidates = isAbsolute(binary) || binary.includes(sep)
    ? [resolve(binary)]
    : (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((dir) => resolve(dir, binary));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const canonical = await realpath(candidate);
      if ((await stat(canonical)).isFile()) return canonical;
    } catch { /* Keep searching; never include paths or OS messages in errors. */ }
  }
  throw new CaptureFailure("HOST_NOT_FOUND");
}

interface NativeSkill {
  name: string;
  path: string;
  scope: string | null;
  enabled: boolean | null;
}

export interface ParsedInventory {
  skills: NativeSkill[];
  errors: { code: string; scope: string }[];
}

/** Parse only the metadata that SkillWhy needs; discard text and dependency fields. */
export function parseSkillsList(payload: unknown, cwd: string): ParsedInventory {
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new CaptureFailure("SKILLS_SCHEMA_INVALID");
  if (payload.data.length !== 1) throw new CaptureFailure("SKILLS_CWD_RESPONSE_MISMATCH");
  const row: unknown = payload.data[0];
  if (!isRecord(row) || typeof row.cwd !== "string" || !isAbsolute(row.cwd) || normalize(row.cwd) !== normalize(cwd)) {
    throw new CaptureFailure("SKILLS_CWD_RESPONSE_MISMATCH");
  }
  if (!Array.isArray(row.skills) || !Array.isArray(row.errors)) throw new CaptureFailure("SKILLS_SCHEMA_INVALID");
  const result: ParsedInventory = { skills: [], errors: [] };
  if (row.errors.length) result.errors.push({ code: "NATIVE_SKILL_ERRORS", scope: "inventory" });
  if (row.skills.length > MAX_ENTRIES) result.errors.push({ code: "SKILL_COUNT_LIMIT", scope: "inventory" });
  for (const value of row.skills.slice(0, MAX_ENTRIES) as unknown[]) {
    if (!isRecord(value) || typeof value.name !== "string" || !value.name || value.name.length > MAX_NAME_LENGTH || CONTROL_CHARACTERS.test(value.name) ||
      typeof value.path !== "string" || !value.path || value.path.length > MAX_PATH_LENGTH || CONTROL_CHARACTERS.test(value.path)) {
      result.errors.push({ code: "SKILL_METADATA_INVALID", scope: "inventory" });
      continue;
    }
    if ((projectLocation(cwd, value.path)?.length ?? 0) > MAX_PATH_LENGTH) {
      result.errors.push({ code: "SKILL_METADATA_INVALID", scope: "inventory" });
      continue;
    }
    const enabled = typeof value.enabled === "boolean" ? value.enabled : null;
    const scope = typeof value.scope === "string" && ["user", "repo", "system", "admin"].includes(value.scope) ? value.scope : null;
    if (enabled === null || scope === null || typeof value.description !== "string") {
      result.errors.push({ code: "SKILL_METADATA_INCOMPLETE", scope: "inventory" });
    }
    result.skills.push({ name: value.name, path: value.path, enabled, scope });
  }
  // Stable output independent of native row ordering; identical duplicates remain.
  result.skills.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name) ||
    String(a.scope).localeCompare(String(b.scope)) || String(a.enabled).localeCompare(String(b.enabled)));
  result.errors = result.errors.filter((error, i, all) => all.findIndex((other) => other.code === error.code) === i);
  return result;
}

function emptyContent(status: SkillEntry["content"]["status"]): SkillEntry["content"] {
  return { status, algorithm: "sha256", coverage: ["SKILL.md"], digest: null };
}

/**
 * No traversal: read one explicitly returned file under the selected project.
 * Symlinks in the relative path are refused. Metadata checks detect ordinary
 * concurrent replacement; this is not a hostile-filesystem isolation boundary.
 */
export async function readSkillDigest(root: string, sourcePath: string): Promise<SkillEntry["content"]> {
  if (!isAbsolute(sourcePath)) return emptyContent("nonlocal");
  const candidate = normalize(sourcePath);
  if (!inside(root, candidate)) return emptyContent("outside-scope");
  if (basename(candidate) !== "SKILL.md") return emptyContent("unreadable");
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const rel = relative(root, candidate);
    const components = rel.split(sep);
    let cursor = root;
    const parents: { path: string; dev: number; ino: number }[] = [];
    for (const component of components.slice(0, -1)) {
      cursor = join(cursor, component);
      const item = await lstat(cursor);
      if (!item.isDirectory() || item.isSymbolicLink()) return emptyContent("unreadable");
      parents.push({ path: cursor, dev: item.dev, ino: item.ino });
    }
    const before = await lstat(candidate);
    if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_FILE_BYTES) return emptyContent("unreadable");
    if (!inside(root, await realpath(candidate))) return emptyContent("outside-scope");
    handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > MAX_FILE_BYTES || opened.dev !== before.dev || opened.ino !== before.ino) {
      return emptyContent("changed-during-read");
    }
    const data = Buffer.alloc(MAX_FILE_BYTES + 1);
    let count = 0;
    while (count < data.length) {
      const read = await handle.read(data, count, data.length - count, count);
      if (read.bytesRead === 0) break;
      count += read.bytesRead;
    }
    const after = await handle.stat();
    const linked = await lstat(candidate);
    if (count > MAX_FILE_BYTES || !linked.isFile() || linked.isSymbolicLink() ||
      linked.dev !== opened.dev || linked.ino !== opened.ino ||
      opened.size !== after.size || opened.mtimeMs !== after.mtimeMs || opened.ctimeMs !== after.ctimeMs || count !== after.size) {
      return emptyContent("changed-during-read");
    }
    for (const parent of parents) {
      const current = await lstat(parent.path);
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== parent.dev || current.ino !== parent.ino) {
        return emptyContent("changed-during-read");
      }
    }
    return { ...emptyContent("collected"), digest: createHash("sha256").update(data.subarray(0, count)).digest("hex") };
  } catch { return emptyContent("unreadable"); }
  finally { await handle?.close().catch(() => {}); }
}

export async function captureSnapshot(options: CaptureOptions): Promise<Snapshot> {
  const snapshot = baseSnapshot();
  try {
    if (!options.cwd || !Number.isFinite(options.timeoutMs ?? 30_000) || (options.timeoutMs ?? 30_000) < 1) {
      throw new CaptureFailure("CAPTURE_OPTIONS_INVALID");
    }
    const cwd = await realpath(resolve(options.cwd)).catch(() => { throw new CaptureFailure("CWD_UNAVAILABLE"); });
    if (!(await stat(cwd)).isDirectory()) throw new CaptureFailure("CWD_NOT_DIRECTORY");
    const executable = await executablePath(options.codexBin ?? "codex");
    const timeoutMs = Math.min(options.timeoutMs ?? 30_000, 120_000);
    const version = await probeVersion({ executable, cwd, timeoutMs: Math.min(timeoutMs, 5_000) });
    snapshot.capture.hostVersion = version;
    if (version !== SUPPORTED_CODEX_VERSION || process.platform !== "darwin" || process.arch !== "arm64") {
      snapshot.capture.status = "unsupported";
      snapshot.errors.push({ code: "UNSUPPORTED_HOST_COMBINATION", scope: "capture" });
      return snapshot;
    }
    const observation = await querySkills({ executable, cwd, timeoutMs });
    const parsed = parseSkillsList(observation.payload, cwd);
    snapshot.errors.push(...parsed.errors);
    if (observation.shutdownForced) snapshot.errors.push({ code: "HOST_SHUTDOWN_FORCED", scope: "capture" });
    const external = new Map<string, string>();
    for (const [index, skill] of parsed.skills.entries()) {
      let locationAlias: string;
      const projectAlias = projectLocation(cwd, skill.path);
      if (projectAlias !== null) {
        locationAlias = projectAlias;
      } else {
        const key = isAbsolute(skill.path) ? dirname(skill.path) : skill.path;
        let alias = external.get(key);
        if (!alias) {
          alias = `external-${String(external.size + 1).padStart(3, "0")}`;
          external.set(key, alias);
          snapshot.rootMappings.push({ alias, role: "external", userConfirmed: false });
        }
        locationAlias = `${alias}/SKILL.md`;
      }
      const entryId = `entry-${String(index + 1).padStart(4, "0")}`;
      const content = options.digest ? await readSkillDigest(cwd, skill.path) : emptyContent("not-requested");
      const entry: SkillEntry = {
        entryId, name: skill.name, label: skill.name, comparisonKey: null,
        nativeScope: skill.scope, enabled: skill.enabled, locationAlias,
        sourcePath: skill.path, content,
        evidence: [
          { field: "name", level: "observed", source: "skills/list", reference: "inventory-1" },
          { field: "enabled", level: skill.enabled === null ? "unknown" : "observed", source: "skills/list", reference: "inventory-1" },
        ],
      };
      if (options.digest) entry.evidence.push({ field: "content.digest", level: content.status === "collected" ? "observed" : "unknown", source: "filesystem", reference: entryId });
      snapshot.entries.push(entry);
    }
    const names = new Map<string, string[]>();
    for (const entry of snapshot.entries) {
      const list = names.get(entry.name ?? "") ?? [];
      list.push(entry.entryId);
      names.set(entry.name ?? "", list);
    }
    for (const entryIds of names.values()) {
      if (entryIds.length > 1) snapshot.findings.push({ code: "DUPLICATE_NAME_RETURNED", level: "observed", entryIds });
    }
    snapshot.capture.status = snapshot.errors.length ? "partial" : "complete";
    snapshot.coverage.inventory = snapshot.errors.length ? "partial" : "complete-for-request";
    return snapshot;
  } catch (error) {
    snapshot.capture.status = "error";
    snapshot.coverage.inventory = "unknown";
    snapshot.errors.push({ code: error instanceof CaptureFailure ? error.code : "CAPTURE_FAILED", scope: "capture" });
    return snapshot;
  }
}
