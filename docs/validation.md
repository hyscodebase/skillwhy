# Alpha validation record

Date: 2026-11-02. These observations are scoped engineering checks, not a claim
of production readiness, adoption, or model accuracy.

## Actual native smoke check

- Codex CLI: 0.166.0.
- Platform: macOS arm64.
- Node.js: 24.8.0.
- A fresh app-server metadata request completed successfully.
- A temporary, locally authored fixture skill was returned and marked enabled.
- With `--digest`, its regular project-local SKILL.md produced a SHA-256 hash.
- After editing only that fixture's text, a second capture and explicitly scoped
  comparison reported the changed fingerprint.
- Global entries outside the selected comparison scope were left unassessed.

No model turns, skill invocation, current Desktop state, or paid API operation
was tested. Private native snapshots, schema dumps, original paths, and local
skill inventory are excluded from the repository and distribution.

## Automated checks

The test suite covers strict snapshot validation, selected sharing, partial and
ambiguous comparisons, bounded protocol handling, malformed/error responses,
file constraints, and CLI behavior. Process tests launch fake local executables.
See the CI result for the exact commit and test count.

CI's Node/OS matrix validates SkillWhy's own offline and fake-process code; it
does not establish live Codex support on those CI operating systems.

The compiled npm-format tarball was installed in a separate temporary directory
without this repository's development dependencies. Its installed CLI ran the
offline demo successfully. The distribution file list was checked to exclude
private snapshots, schema dumps, and node_modules.

## Still unverified

- Live capture on other Codex versions or OS combinations.
- Model selection, skill execution, performance improvement, or Desktop state.
- All managed settings, plugin backends, and remote environments.
- External user onboarding, real support-case impact, and repeat adoption.

The support manifest deliberately remains narrow until new live evidence and
conformance cases are available.
