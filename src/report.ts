import type { Comparison, Snapshot } from "./types.js";

/** Strip terminal controls from untrusted labels. JSON output remains structured. */
export function display(value: unknown): string {
  return String(value ?? "unknown").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ");
}

export function renderComparison(result: Comparison, detail = false): string {
  const lines = [
    "SkillWhy · skill discovery comparison",
    ...(result.synthetic ? ["SYNTHETIC EXAMPLE — NOT A LIVE SCAN"] : []),
    `Result: ${result.status} · compared entries: ${result.comparedEntries}`,
    "",
  ];
  if (result.differences.length === 0) lines.push("No differences found within the compared evidence.");
  for (const difference of result.differences) {
    lines.push(`${display(difference.key)} · ${difference.kind}`);
    lines.push(`  ${display(difference.before)} → ${display(difference.after)} [${difference.evidence}]`);
    if (detail) lines.push(`  ${display(difference.explanation)}`);
  }
  if (result.notes.length > 0) lines.push("", ...result.notes.map(note => `Note: ${display(note)}`));
  lines.push("", "Model selected/read/executed a skill: NOT OBSERVED", "Existing Desktop session: NOT ASSESSED");
  return lines.join("\n");
}

export function renderCapture(snapshot: Snapshot): string {
  return [
    `SkillWhy · capture ${snapshot.capture.status}`,
    `Codex CLI ${display(snapshot.capture.hostVersion)} · fresh process`,
    `Returned entries: ${snapshot.entries.length} · reported errors: ${snapshot.errors.length}`,
    "Model execution and the existing Desktop session were not observed.",
  ].join("\n");
}
