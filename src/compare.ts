import type { CompareOptions, Comparison, Difference, SkillEntry, Snapshot } from "./types.js";

interface Group {
  key: string;
  left: SkillEntry[];
  right: SkillEntry[];
  mapped: boolean;
}

function usableInventory(snapshot: Snapshot): boolean {
  return snapshot.capture.status === "complete" && snapshot.coverage.inventory === "complete-for-request" && snapshot.errors.length === 0;
}

function fullKnownInventory(snapshot: Snapshot): boolean {
  return usableInventory(snapshot) && snapshot.coverage.includedEntries === "all-returned" && snapshot.coverage.roots === "known";
}

function checkedMapping(left: Snapshot, right: Snapshot, options: CompareOptions): Map<string, string> {
  const map = new Map<string, string>();
  if (options.rootMap === undefined) return map;
  if (options.rootMap === null || typeof options.rootMap !== "object" || Array.isArray(options.rootMap)) throw new Error("Invalid root mapping.");
  const entries = Object.entries(options.rootMap);
  if (entries.length > 10_000) throw new Error("Too many root mappings.");
  const leftAliases = new Set(left.rootMappings.map(mapping => mapping.alias));
  const rightAliases = new Set(right.rootMappings.map(mapping => mapping.alias));
  const targets = new Set<string>();
  for (const [source, target] of entries) {
    if (typeof target !== "string" || !leftAliases.has(source) || !rightAliases.has(target)) throw new Error("Root mapping references an unknown alias.");
    if (targets.has(target)) throw new Error("Root mappings must be one-to-one.");
    targets.add(target);
    map.set(source, target);
  }
  return map;
}

function relativeLocation(location: string, aliases: readonly string[]): { root: string; relative: string } | null {
  const root = aliases.find(alias => location === alias || location.startsWith(`${alias}/`));
  if (root === undefined) return null;
  return { root, relative: location.slice(root.length) };
}

/** Compares explicitly associated observations; it never infers a winning duplicate. */
export function compareSnapshots(left: Snapshot, right: Snapshot, options: CompareOptions = {}): Comparison {
  if (left.artifactKind !== right.artifactKind) throw new Error("Cannot compare private snapshots with selected shares. Compare two artifacts of the same kind.");
  const rootMap = checkedMapping(left, right, options);
  const reverseMap = new Map([...rootMap].map(([source, target]) => [target, source]));
  // Resolve ownership against every declared root first. A more specific root
  // must not silently enter the comparison through a selected parent root.
  const leftAliases = left.rootMappings.map(mapping => mapping.alias).sort((a, b) => b.length - a.length);
  const rightAliases = right.rootMappings.map(mapping => mapping.alias).sort((a, b) => b.length - a.length);
  const differences: Difference[] = [];
  const notes = new Set<string>([
    "Comparison covers explicitly associated fresh CLI observations only; it does not establish whole-machine equivalence.",
    "Skill discovery and enabled state do not prove model loading, invocation, or execution. Active Desktop sessions were not observed.",
    "Content fingerprints cover SKILL.md only; referenced files and scripts were not compared.",
  ]);
  let inconclusive = !usableInventory(left) || !usableInventory(right);
  let comparedEntries = 0;

  function add(difference: Difference): void {
    differences.push(difference);
    if (difference.kind === "unknown" || difference.kind === "ambiguous-match") inconclusive = true;
  }

  if (inconclusive) {
    notes.add("At least one capture has incomplete or failed inventory evidence. Unreturned entries cannot be treated as removals or additions.");
  }
  if (left.coverage.roots !== "known" || right.coverage.roots !== "known") notes.add("Discovery roots are not fully established. Unmatched entries cannot establish scoped absence.");
  if (left.coverage.includedEntries === "selected" || right.coverage.includedEntries === "selected") notes.add("A selected share contains only approved entries. Omitted entries are unknown, not missing.");

  if (left.capture.hostVersion !== right.capture.hostVersion) {
    add({ kind: "host-version-changed", key: "capture.hostVersion", before: left.capture.hostVersion, after: right.capture.hostVersion, evidence: "observed", explanation: "Reported host versions differ. This observation does not establish the cause of a skill difference." });
  }
  for (const field of ["inventory", "includedEntries", "roots"] as const) {
    if (left.coverage[field] !== right.coverage[field]) {
      add({ kind: "coverage-changed", key: `coverage.${field}`, before: left.coverage[field], after: right.coverage[field], evidence: "observed", explanation: "The snapshots declare different observation coverage; interpret entry differences within those limits." });
    }
  }
  if (left.capture.status !== right.capture.status) {
    add({ kind: "coverage-changed", key: "capture.status", before: left.capture.status, after: right.capture.status, evidence: "observed", explanation: "Capture completion states differ. A failed or partial lookup is not evidence that an entry is absent." });
  }

  const groups = new Map<string, Group>();
  function collect(snapshot: Snapshot, side: "left" | "right"): void {
    let excluded = 0;
    for (const entry of snapshot.entries) {
      const declaredLocation = relativeLocation(entry.locationAlias, side === "left" ? leftAliases : rightAliases);
      const selectedRoots = side === "left" ? rootMap : reverseMap;
      const location = declaredLocation !== null && selectedRoots.has(declaredLocation.root) ? declaredLocation : null;
      let internalKey: string;
      let displayKey: string;
      let mapped = false;
      if (entry.comparisonKey !== null) {
        internalKey = JSON.stringify(["explicit-key", entry.comparisonKey]);
        displayKey = `key:${entry.comparisonKey}`;
        mapped = location !== null;
      } else if (location !== null) {
        const source = side === "left" ? location.root : reverseMap.get(location.root);
        const target = side === "left" ? rootMap.get(location.root) : location.root;
        internalKey = JSON.stringify(["mapped-path", source, target, location.relative]);
        displayKey = `path:${source}=>${target}${location.relative}`;
        mapped = true;
      } else {
        if (rootMap.size > 0) {
          // A supplied root map selects comparison scope; unrelated global skills
          // must not make a project-only comparison noisy or imply absence.
          excluded += 1;
          continue;
        }
        // Unique per side: even equal names or locations are not implicit mappings.
        internalKey = JSON.stringify(["unmapped", side, entry.entryId]);
        displayKey = `${side}:entry:${entry.entryId}`;
      }
      const existing = groups.get(internalKey);
      if (existing === undefined) {
        const group: Group = { key: displayKey, left: [], right: [], mapped };
        group[side].push(entry);
        groups.set(internalKey, group);
      } else {
        existing[side].push(entry);
        existing.mapped = existing.mapped && mapped;
      }
    }
    if (excluded > 0) notes.add(`${side}: ${excluded} entries outside the selected root mapping were not compared. Their presence, absence, and equality were not assessed.`);
  }
  collect(left, "left");
  collect(right, "right");

  const canDeclareUnreturned = fullKnownInventory(left) && fullKnownInventory(right);
  for (const group of groups.values()) {
    if (group.left.length > 1 || group.right.length > 1) {
      if (group.left.length !== group.right.length) {
        add({ kind: "multiplicity-changed", key: group.key, before: group.left.length, after: group.right.length, evidence: "observed", explanation: "The number of returned entries at this explicit identity differs. These are observed counts, not a claim about omitted entries or a winning copy." });
      }
      add({ kind: "ambiguous-match", key: group.key, before: group.left.length, after: group.right.length, evidence: "unknown", explanation: "An explicit comparison identity has multiple entries. All copies are preserved; no winner or individual pairing was inferred." });
      continue;
    }
    const before = group.left[0];
    const after = group.right[0];
    if (before === undefined || after === undefined) {
      if (canDeclareUnreturned && group.mapped) {
        add({ kind: before === undefined ? "added" : "not-returned", key: group.key, before: before === undefined ? null : before.label, after: after === undefined ? null : after.label, evidence: "observed", explanation: "This entry was returned on only one side of the explicitly mapped scope. This is scoped lookup evidence, not proof of deletion, global absence, or execution behavior." });
      } else {
        add({ kind: "unknown", key: group.key, before: before === undefined ? null : before.label, after: after === undefined ? null : after.label, evidence: "unknown", explanation: "No corresponding entry was established. Explicit root association and complete unfiltered root coverage are required to claim a scoped addition or non-return." });
      }
      continue;
    }
    comparedEntries += 1;
    if (before.enabled === null || after.enabled === null) {
      add({ kind: "unknown", key: `${group.key}:enabled`, before: before.enabled, after: after.enabled, evidence: "unknown", explanation: "At least one enabled state is unknown. Two unknown values do not establish equal enabled state." });
    } else if (before.enabled !== after.enabled) {
      add({ kind: "enabled-changed", key: group.key, before: before.enabled, after: after.enabled, evidence: "observed", explanation: "The returned enabled values differ for the explicitly associated entries. This does not establish selection or execution." });
    }
    if (before.name !== null && after.name !== null && before.name !== after.name) {
      add({ kind: "name-changed", key: group.key, before: before.name, after: after.name, evidence: "observed", explanation: "Returned skill names differ at the explicitly associated identity. This does not change the explicit association or establish runtime behavior." });
    }
    if (before.nativeScope !== null && after.nativeScope !== null && before.nativeScope !== after.nativeScope) {
      add({ kind: "scope-changed", key: group.key, before: before.nativeScope, after: after.nativeScope, evidence: "observed", explanation: "Returned native scope labels differ. No scope precedence, winning copy, or cause was inferred." });
    } else if (before.nativeScope === null || after.nativeScope === null) {
      notes.add("Some native scope labels are unavailable. Equal scope or precedence was not established for those entries.");
    }

    const beforeDigest = before.content.digest;
    const afterDigest = after.content.digest;
    if (before.content.status === "collected" && after.content.status === "collected" && beforeDigest !== null && afterDigest !== null) {
      if (beforeDigest.toLowerCase() !== afterDigest.toLowerCase()) {
        add({ kind: "content-changed", key: group.key, before: beforeDigest, after: afterDigest, evidence: "observed", explanation: "The collected SKILL.md byte fingerprints differ. Referenced resources and runtime behavior were not compared." });
      }
    } else {
      const intentional = new Set(["collected", "not-requested", "redacted"]);
      if (intentional.has(before.content.status) && intentional.has(after.content.status)) {
        notes.add(`SKILL.md contents were not compared for ${group.key}: a fingerprint was intentionally omitted. Missing fingerprints do not establish equal contents.`);
      } else {
        add({ kind: "unknown", key: `${group.key}:content`, before: before.content.status, after: after.content.status, evidence: "unknown", explanation: "A content fingerprint could not be collected within the allowed scope. Equal or different SKILL.md contents were not established." });
      }
    }
    if (before.name === null || after.name === null) notes.add("Some names were omitted or unavailable. Identity association uses explicit keys or mapped relative locations, never a name guess.");
  }

  if (groups.size === 0 && (!canDeclareUnreturned || rootMap.size === 0)) {
    add({ kind: "unknown", key: "empty-inventories", before: 0, after: 0, evidence: "unknown", explanation: "Two empty returned lists do not establish equivalent discovery coverage without explicit mapped roots and complete known inventories." });
  }

  return { status: inconclusive ? "inconclusive" : "complete", synthetic: left.capture.synthetic || right.capture.synthetic, differences, comparedEntries, notes: [...notes] };
}
