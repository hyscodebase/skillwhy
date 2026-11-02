#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { captureSnapshot } from "./capture.js";
import { compareSnapshots } from "./compare.js";
import { createShareBundle } from "./share.js";
import { readSnapshot, writeSnapshot } from "./io.js";
import { demoSnapshots } from "./demo.js";
import { display, renderCapture, renderComparison } from "./report.js";

const VERSION = "0.1.0-alpha.1";
const help = `SkillWhy ${VERSION}
Compare what fresh Codex CLI processes discover. No model turns are requested.

Commands:
  skillwhy demo [--json] [--detail]
  skillwhy capture --cwd DIR --out FILE [--agent codex] [--digest]
  skillwhy diff LEFT RIGHT [--map-root project=project] [--detail] [--json]
  skillwhy share --snapshot FILE --entry ID --alias LABEL --preview
  skillwhy share --snapshot FILE --skill NAME --alias LABEL --out FILE

Capture options:
  --codex-bin PATH      Select a local Codex executable
  --timeout-ms N        Metadata request timeout, 1000–60000 ms (default 30000)
  --digest             Read SKILL.md only within the selected project

Share options:
  --include-name       Explicitly include the selected skill's name
  --include-digest     Explicitly include its SKILL.md fingerprint
  --preview            Print the exact minimal bundle instead of writing it

Shared comparison keys use your explicit --alias. Use the same alias only
for entries you have confirmed correspond. Omitted fields stay unknown.
Files are created with owner-only permissions and never overwritten.
Exit 0: command completed (differences are normal). Exit 2: inconclusive/error.
This alpha does not inspect an existing Desktop session or skill execution.
`;

function parseCliArgs() { return parseArgs({
  allowPositionals: true, strict: true,
  options: {
    help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" },
    agent: { type: "string" }, cwd: { type: "string" }, out: { type: "string" },
    json: { type: "boolean" }, detail: { type: "boolean" }, digest: { type: "boolean" },
    "map-root": { type: "string", multiple: true }, snapshot: { type: "string" },
    entry: { type: "string" }, skill: { type: "string" }, alias: { type: "string" },
    "include-name": { type: "boolean" }, "include-digest": { type: "boolean" }, preview: { type: "boolean" },
    "codex-bin": { type: "string" }, "timeout-ms": { type: "string" },
  },
}); }

async function main(): Promise<number> {
  const { values, positionals } = parseCliArgs();
  if (values.version) { console.log(VERSION); return 0; }
  if (values.help || positionals.length === 0) { console.log(help); return 0; }
  const [command, ...args] = positionals;
  const allowed: Record<string, string[]> = {
    demo: ["json", "detail"], capture: ["agent", "cwd", "out", "digest", "codex-bin", "timeout-ms"],
    diff: ["map-root", "detail", "json"], share: ["snapshot", "entry", "skill", "alias", "include-name", "include-digest", "preview", "out"],
  };
  const flags = command ? allowed[command] : undefined;
  if (!flags) throw new Error("Unknown command. Run skillwhy --help.");
  for (const flag of Object.keys(values)) if (!flags.includes(flag)) throw new Error(`Option --${flag} does not apply to this command.`);
  if (command !== "diff" && args.length) throw new Error("Unexpected positional arguments.");

  if (command === "demo") {
    const [left, right] = demoSnapshots();
    const comparison = compareSnapshots(left, right);
    console.log(values.json ? JSON.stringify(comparison, null, 2) : renderComparison(comparison, true));
    return comparison.status === "complete" ? 0 : 2;
  }
  if (command === "capture") {
    if (!values.out || !values.cwd) throw new Error("capture requires --cwd DIR and --out FILE.");
    if (values.agent !== undefined && values.agent !== "codex") throw new Error("Only --agent codex is supported.");
    const timeoutMs = values["timeout-ms"] === undefined ? 30000 : Number(values["timeout-ms"]);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error("--timeout-ms must be an integer from 1000 to 60000.");
    const snapshot = await captureSnapshot({
      cwd: resolve(values.cwd), timeoutMs, digest: values.digest ?? false,
      ...(values["codex-bin"] ? { codexBin: values["codex-bin"] } : {}),
    });
    await writeSnapshot(resolve(values.out), snapshot);
    console.log(renderCapture(snapshot));
    console.log(`Private snapshot saved: ${display(values.out)}`);
    return snapshot.capture.status === "complete" ? 0 : 2;
  }
  if (command === "diff") {
    if (args.length !== 2) throw new Error("diff requires exactly two snapshot paths.");
    const [leftPath, rightPath] = args as [string, string];
    const [left, right] = await Promise.all([readSnapshot(resolve(leftPath)), readSnapshot(resolve(rightPath))]);
    const rootMap: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const mapping of values["map-root"] ?? []) {
      const parts = mapping.split("=");
      if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Use --map-root LEFT_ALIAS=RIGHT_ALIAS.");
      if (Object.hasOwn(rootMap, parts[0])) throw new Error("A root alias was mapped more than once.");
      rootMap[parts[0]] = parts[1];
    }
    const comparison = compareSnapshots(left, right, { rootMap });
    console.log(values.json ? JSON.stringify(comparison, null, 2) : renderComparison(comparison, values.detail ?? false));
    return comparison.status === "complete" ? 0 : 2;
  }
  if (command === "share") {
    if (!values.snapshot || !values.alias) throw new Error("share requires --snapshot FILE and an explicit --alias LABEL.");
    if (Boolean(values.entry) === Boolean(values.skill)) throw new Error("Select exactly one of --entry ID or --skill NAME.");
    if (Boolean(values.preview) === Boolean(values.out)) throw new Error("Choose exactly one of --preview or --out FILE.");
    const snapshot = await readSnapshot(resolve(values.snapshot));
    const entries = snapshot.entries.filter(entry => values.entry ? entry.entryId === values.entry : entry.name === values.skill);
    if (entries.length !== 1) throw new Error("Selection must match one entry. For duplicate names, use the entryId from your private snapshot with --entry.");
    const entry = entries[0]!;
    const bundle = createShareBundle(snapshot, { entryIds: [entry.entryId], alias: values.alias, includeName: values["include-name"] ?? false, includeDigest: values["include-digest"] ?? false });
    if (values.preview) console.log(JSON.stringify(bundle, null, 2));
    else {
      await writeSnapshot(resolve(values.out!), bundle);
      console.log(`Minimal bundle saved: ${display(values.out)}. No upload was performed.`);
      console.log("Review the file before sharing. Omitted entries and fields remain unknown.");
    }
    return bundle.capture.status === "complete" ? 0 : 2;
  }
  return 2;
}

main().then(code => { process.exitCode = code; }).catch(error => {
  console.error(`SkillWhy: ${display(error instanceof Error ? error.message : "Command failed.")}`);
  process.exitCode = 2;
});
