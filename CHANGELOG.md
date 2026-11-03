# Changelog

## 0.1.0-alpha.4 — 2026-11-03

- Recommend the public npm `alpha` installation in the English and Korean
  quickstarts after an isolated registry install and demo passed for alpha.3.
- Record the initial package's integrity against the compiled GitHub release,
  and document npm's publish-time availability delay and OIDC validation gate.
- Include reviewed GitHub Actions updates in this release. Native capture
  support and comparison behavior are unchanged from alpha.3.

## 0.1.0-alpha.3 — 2026-11-02

- Add specific next steps for unsupported, partial, and failed captures and
  unassociated private comparisons, plus a troubleshooting guide.
- Add a 42-second GIF/video from actual synthetic CLI output with its full
  transcript and reproducible renderer. This is not an external user case.
- Reuse one CI workflow for branch checks and releases, gate it with a pinned
  actionlint build and semantic regression probes, and group weekly dependency
  update proposals.
- Prepare public npm metadata and a manual distribution workflow that defaults
  to a verified packaging dry run. npm registry publication still requires the
  namespace owner's account setup and a successful real publication.
- Add opt-in candidate native conformance, keeping experimental combinations
  separate from the production support manifest.
- Extend Codex 0.166.0 native capture to Linux x64 after actual candidate
  conformance on Ubuntu 24.04 with Node 22.20.0 and 24.8.0. Preserve the sanitized
  run evidence and check the promoted production manifest separately.
- Prepare maintainer interviews, public-source pilot candidates, and reviewed
  outreach drafts. External responses and useful-case outcomes remain pending.
- Add weekly public GitHub aggregate reports and a separate manual evidence
  register. Repository interest signals are not interpreted as actual users.

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
