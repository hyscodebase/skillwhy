# Changelog

## 0.1.0-alpha.2 — 2026-11-02

- Add `inspect` to find individual entry IDs, including duplicate names, without
  opening raw snapshots. The local view omits source paths and digest values;
  `share` remains the explicit support-bundle workflow.
- Provide a short tagged-source demo command and a compiled release installation
  guide in English and Korean.
- Read the CLI, adapter, and protocol client version from package metadata.
- Add an opt-in native fixture runner. Ten checks passed with Codex 0.166.0 on
  macOS arm64 under Node 22.20.0 and 24.8.0, including disabled copies, duplicates,
  changed fingerprints, selected sharing, and missing-description errors.
- Add tag/version/commit validation and automatic GitHub prereleases after the
  test matrix and an isolated packaged-install smoke test, with SHA-256 assets.
- Add a short external pilot guide and structured feedback form. Pilot outcomes
  remain unverified; these are collection materials, not adoption evidence.

Native compatibility remains Codex 0.166.0 on macOS arm64. A complete metadata
capture does not establish SKILL.md syntax validity, model execution, or the
state of an existing Desktop session. No npm registry publication is included.

## 0.1.0-alpha.1 — 2026-11-02

Initial alpha: offline synthetic demo, version-bounded fresh Codex discovery,
explicitly scoped snapshot comparison, and single-entry support bundles.

Includes strict schemas, duplicate preservation, uncertainty handling, private
file creation, opt-in fingerprints, and no default telemetry or uploads.

Native capture initially targets Codex 0.166.0 on macOS arm64. No model execution,
current Desktop inspection, automatic repair, or CI policy gate is included.
