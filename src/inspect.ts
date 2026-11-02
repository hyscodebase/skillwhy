import { posix, win32 } from "node:path";
import { display } from "./report.js";
import { parseSnapshot } from "./validate.js";
import type { CaptureStatus, SkillEntry, Snapshot } from "./types.js";

export interface InspectOptions {
  /** Exact skill name; selected shares also allow their public label as a fallback. */
  skill?: string;
}

export interface InspectedEntry {
  entryId: string;
  name: string | null;
  label: string;
  enabled: boolean | null;
  nativeScope: string | null;
  locationAlias: string;
  content: { status: SkillEntry["content"]["status"]; digestPresent: boolean };
}

export interface Inspection {
  kind: "inspection-v1";
  artifactKind: Snapshot["artifactKind"];
  captureStatus: CaptureStatus;
  inventory: Snapshot["coverage"]["inventory"];
  includedEntries: Snapshot["coverage"]["includedEntries"];
  synthetic: boolean;
  totalEntries: number;
  matchedEntries: number;
  filterMatch: "unfiltered" | "name" | "share-label" | "none";
  entries: InspectedEntry[];
  notes: string[];
}

/** Redact path-shaped text even when it was placed in an otherwise permitted field. */
function localDisplay(value: string): string {
  const shown = display(value);
  const trimmed = shown.trim();
  if (posix.isAbsolute(trimmed) || win32.isAbsolute(trimmed) || /(?:^|[\s"'<(=])(?:[A-Za-z]:[\\/]|[\\/]|~[\\/])|\bfile:/iu.test(shown)) return "[redacted-path]";
  return shown;
}

/**
 * Return a local inspection projection, never the raw snapshot. Input is checked
 * again so library callers receive the same bounded validation as CLI callers.
 * No filesystem reads, source paths, digest values, or native messages are used.
 */
export function inspectSnapshot(value: unknown, options: InspectOptions = {}): Inspection {
  const snapshot = parseSnapshot(value);
  if (options === null || typeof options !== "object" || Array.isArray(options)) throw new Error("Invalid inspection options.");
  if (Object.keys(options).some(key => key !== "skill")) throw new Error("Unknown inspection option.");
  if (options.skill !== undefined && (typeof options.skill !== "string" || options.skill.length === 0 || options.skill.length > 256)) throw new Error("Inspection requires a non-empty exact skill name or public share label.");

  let selected = snapshot.entries;
  let filterMatch: Inspection["filterMatch"] = "unfiltered";
  if (options.skill !== undefined) {
    selected = snapshot.entries.filter(entry => entry.name === options.skill);
    filterMatch = selected.length > 0 ? "name" : "none";
    if (selected.length === 0 && snapshot.artifactKind === "share-v1") {
      selected = snapshot.entries.filter(entry => entry.label === options.skill);
      if (selected.length > 0) filterMatch = "share-label";
    }
  }

  let sanitized = false;
  const safe = (value: string): string => {
    const output = localDisplay(value);
    if (output !== value) sanitized = true;
    return output;
  };
  const entries: InspectedEntry[] = selected.map(entry => ({
    entryId: safe(entry.entryId),
    name: entry.name === null ? null : safe(entry.name),
    label: safe(entry.label),
    enabled: entry.enabled,
    nativeScope: entry.nativeScope === null ? null : safe(entry.nativeScope),
    locationAlias: safe(entry.locationAlias),
    content: { status: entry.content.status, digestPresent: entry.content.status === "collected" && entry.content.digest !== null },
  }));

  const notes = [
    "Local inspection: names and relative location aliases may be private. Review this output before sharing; use share to create a minimal bundle.",
    "Entry IDs identify individual returned copies. Duplicate names are listed separately; no winning copy is inferred.",
    "Source paths and digest values are omitted. A present digest covers SKILL.md only; an omitted digest does not establish equal contents.",
    "Skill loading, selection, execution, and the existing Desktop session were not observed.",
  ];
  if (snapshot.artifactKind === "share-v1" || snapshot.coverage.includedEntries === "selected") {
    notes.push("Selected subset: this artifact contains only approved entries. Other skills and omitted fields remain unknown.");
  }
  if (snapshot.artifactKind === "share-v1") {
    notes.push("For a selected share, the skill filter first matches the exact name, then the exact public label if no name matches.");
  }
  if (snapshot.capture.status !== "complete" || snapshot.coverage.inventory !== "complete-for-request" || snapshot.errors.length > 0) {
    notes.push("Capture evidence is incomplete or contains errors. This inspection lists stored entries and does not establish absence.");
  }
  if (filterMatch === "none") notes.push("No entry matched the exact filter in this artifact. This does not prove that the skill is absent from the environment.");
  if (sanitized) notes.push("Some displayed text was sanitized or replaced with [redacted-path]. Displayed values may differ from the stored metadata.");

  return {
    kind: "inspection-v1",
    artifactKind: snapshot.artifactKind,
    captureStatus: snapshot.capture.status,
    inventory: snapshot.coverage.inventory,
    includedEntries: snapshot.coverage.includedEntries,
    synthetic: snapshot.capture.synthetic,
    totalEntries: snapshot.entries.length,
    matchedEntries: entries.length,
    filterMatch,
    entries,
    notes,
  };
}

/** Render the projection for a terminal; use JSON.stringify for structured output. */
export function renderInspection(inspection: Inspection): string {
  const lines = [
    "SkillWhy · local snapshot inspection",
    ...(inspection.synthetic ? ["SYNTHETIC EXAMPLE — NOT A LIVE SCAN"] : []),
    `Artifact: ${display(inspection.artifactKind)} · capture: ${display(inspection.captureStatus)}`,
    `Coverage: ${display(inspection.inventory)} · ${display(inspection.includedEntries)}`,
    `Entries: ${inspection.matchedEntries} of ${inspection.totalEntries} stored · filter: ${display(inspection.filterMatch)}`,
    "",
  ];
  for (const entry of inspection.entries) {
    lines.push(`${localDisplay(entry.entryId)} · ${localDisplay(entry.name ?? entry.label)}`);
    lines.push(`  enabled: ${display(entry.enabled)} · native scope: ${entry.nativeScope === null ? "unknown" : localDisplay(entry.nativeScope)}`);
    lines.push(`  location alias: ${localDisplay(entry.locationAlias)}`);
    lines.push(`  content: ${display(entry.content.status)} · digest: ${entry.content.digestPresent ? "present (value omitted)" : "not available"}`);
  }
  if (inspection.entries.length === 0) lines.push("No entries to display in this stored selection.");
  lines.push("", ...inspection.notes.map(note => `Note: ${display(note)}`));
  return lines.join("\n");
}
