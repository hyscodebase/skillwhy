import test from "node:test";
import assert from "node:assert/strict";
import { demoSnapshots } from "../src/demo.js";
import { renderCapture, renderComparison } from "../src/report.js";
import { compareSnapshots } from "../src/compare.js";

test("unsupported capture offers the current support manifest and an offline route", () => {
  const [snapshot] = demoSnapshots();
  snapshot.capture.status = "unsupported";
  snapshot.errors = [{ code: "UNSUPPORTED_HOST_COMBINATION", scope: "capture" }];
  snapshot.entries[0]!.sourcePath = "/private/REPORT_CANARY/SKILL.md";
  const text = renderCapture(snapshot);
  assert.match(text, /Supported native capture: Codex CLI 0\.166\.0/);
  assert.match(text, /--codex-bin PATH/);
  assert.match(text, /skillwhy demo/);
  assert.match(text, /new --out filename/);
  assert.doesNotMatch(text, /REPORT_CANARY/);
});

test("native metadata and local path errors have specific next steps without raw messages", () => {
  const [snapshot] = demoSnapshots();
  snapshot.capture.status = "partial";
  snapshot.errors = [{ code: "NATIVE_SKILL_ERRORS", scope: "inventory" }];
  assert.match(renderCapture(snapshot), /required description fields/);
  snapshot.capture.status = "error";
  snapshot.errors = [{ code: "CWD_UNAVAILABLE", scope: "capture" }];
  assert.match(renderCapture(snapshot), /--cwd names an existing local project directory/);
  snapshot.errors = [{ code: "PRIVATE_UNKNOWN_CANARY", scope: "capture" }];
  const text = renderCapture(snapshot);
  assert.match(text, /docs\/troubleshooting\.md/);
  assert.doesNotMatch(text, /PRIVATE_UNKNOWN_CANARY/);
});

test("unassociated private entries explain the explicit root mapping and selected sharing routes", () => {
  const [left, right] = demoSnapshots();
  left.entries[0]!.comparisonKey = null;
  right.entries[0]!.comparisonKey = null;
  const result = compareSnapshots(left, right);
  assert.equal(result.status, "inconclusive");
  assert.match(renderComparison(result), /If these project roots correspond/);
  assert.match(renderComparison(result), /--map-root project=project/);
  assert.match(renderComparison(result), /explicitly confirmed common alias/);
  assert.doesNotMatch(renderComparison(compareSnapshots(left, right, { rootMap: { project: "project" } })), /Next: If these/);
});
