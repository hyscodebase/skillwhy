import type { Comparison, Snapshot } from "./types.js";
import { supportedNativeHostLabel } from "./compatibility.js";

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
  if (result.differences.some(item => item.kind === "unknown" && /^(?:left|right):entry:/.test(item.key))) {
    lines.push("", "Next: If these project roots correspond, rerun with --map-root project=project. This selects project entries only.",
      "For one selected skill across environments, create share bundles with an explicitly confirmed common alias.");
  }
  lines.push("", "Model selected/read/executed a skill: NOT OBSERVED", "Existing Desktop session: NOT ASSESSED");
  return lines.join("\n");
}

export function renderCapture(snapshot: Snapshot): string {
  const codes = new Set(snapshot.errors.map(error => error.code));
  const next: string[] = [];
  if (snapshot.capture.status === "unsupported") {
    next.push(`Supported native capture: ${supportedNativeHostLabel()}.`,
      "Use a compatible existing installation with --codex-bin PATH, or try skillwhy demo for the offline example.");
  }
  if (codes.has("HOST_NOT_FOUND")) next.push("Select a compatible local Codex executable with --codex-bin PATH. See docs/compatibility.md.");
  if (codes.has("CWD_UNAVAILABLE") || codes.has("CWD_NOT_DIRECTORY")) next.push("Check that --cwd names an existing local project directory.");
  if (codes.has("NATIVE_SKILL_ERRORS")) next.push("Codex reported skill metadata errors. Review SKILL.md metadata in the local skill locations you use, including required description fields, then capture again.");
  if (codes.has("HOST_TIMEOUT") || codes.has("VERSION_TIMEOUT")) next.push("Check the selected Codex executable. Retry with --timeout-ms 60000 if native startup needs more time.");
  if (snapshot.capture.status === "partial" && next.length === 0) next.push("This inventory is incomplete. Review the safe error codes in your local snapshot before comparing again.");
  if (snapshot.capture.status === "error" && next.length === 0) next.push("Check the supported CLI/OS combination and the local snapshot's error codes. See docs/troubleshooting.md.");
  if (next.length > 0) next.push("Choose a new --out filename when recapturing; snapshot files are never overwritten.");
  return [
    `SkillWhy · capture ${snapshot.capture.status}`,
    `Codex CLI ${display(snapshot.capture.hostVersion)} · fresh process`,
    `Returned entries: ${snapshot.entries.length} · reported errors: ${snapshot.errors.length}`,
    ...next.map(hint => `Next: ${hint}`),
    "Model execution and the existing Desktop session were not observed.",
  ].join("\n");
}
