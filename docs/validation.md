# Alpha validation record

Date: 2026-11-02. These observations are scoped engineering checks, not a claim
of production readiness, adoption, or model accuracy.

## Alpha.2 native conformance

The opt-in [native conformance script](https://github.com/hyscodebase/skillwhy/blob/v0.1.0-alpha.2/scripts/native-conformance.mjs) passed
against the actual installed Codex executable on the following combinations:

| Adapter | Codex CLI | OS / architecture | Node.js | Checked at (UTC) |
| --- | --- | --- | --- | --- |
| 0.1.0-alpha.2 | 0.166.0 | macOS / arm64 | 24.8.0 | 2026-11-02 12:38:23 |
| 0.1.0-alpha.2 | 0.166.0 | macOS / arm64 | 22.20.0 | 2026-11-02 12:38:30 |

Each run exercised the compiled CLI, rather than substituting a fake host:

| Controlled fixture or action | Observed result |
| --- | --- |
| Valid project-local SKILL.md | Returned with `enabled: true`; optional SHA-256 collected. |
| Two different files with the same name | Both returned; both preserved with a duplicate-name finding. |
| Edit only one fixture's body | Explicitly scoped CLI diff reported exactly one content change. |
| Export that selected entry | Single-entry share retained the requested digest and omitted the name, original path, body, and other entries. |
| Session override disables the fixture | Returned with `enabled: false`; diff reported the enabled-state change. |
| SKILL.md omits required `description` | Native error retained as a safe code; capture was partial and exited 2. The invalid fixture was not returned. |
| Compare against that partial capture | Diff was inconclusive and exited 2; it did not claim an addition or absence. |
| Next process without the disabling override | The target was enabled again; the session-only change did not persist. |

The ten reported checks cover these cases and the CLI capture → diff → share flow.
They do not cover every error, filesystem, or managed-policy combination.

Reproduce from a source checkout after installing the supported Codex version:

```sh
npm ci
npm run build
node scripts/native-conformance.mjs --live
# Optional pinned Node 22 runtime; npm may download the runtime package.
npm exec --yes --package=node@22.20.0 -- node scripts/native-conformance.mjs --live
```

`--codex-bin PATH` selects an existing local executable. The script refuses a
different Codex version or platform; it does not install or upgrade Codex.
There are no native checks in the default test suite or CI job.

The script creates temporary fixtures and private snapshots, invokes only the
existing metadata capture protocol, and removes its temporary directory at the
end. Its output contains fixed case names, versions, timestamps, and pass/fail
status; it does not contain the native inventory or stderr. A temporary launcher
passes `-c skills.config=[{path=...,enabled=false}]` to one process. It never writes
the user's configuration or changes `HOME` / `CODEX_HOME`.

This is not a hermetic or network-isolated test. Codex inherits the current user
environment and can discover other configured skill locations. Its own startup
may use the network or write caches/logs; the script does not audit or erase those
effects. Comparisons assess the explicitly mapped project fixtures, and global
entries remain unassessed. An unrelated native error makes the baseline fail
instead of being filtered away to manufacture a passing result.

### Completion does not mean specification validity

In a separate controlled metadata probe on 0.166.0, a fixture containing
`name: [unterminated` and a fixture omitting `name` were both returned without a
native error. A fixture omitting `description` did produce an error. Therefore,
the negative control above deliberately tests the missing required description;
it does not assume that Codex performs strict YAML or Agent Skills validation.

SkillWhy's `complete` status means that its requested native inventory response
completed without reported capture errors. It is not a certificate that every
SKILL.md is valid, discoverable everywhere, loaded, or executed. The official
[skill documentation](https://learn.chatgpt.com/docs/build-skills) describes the
metadata fields and disabling configuration; the observations above apply only
to the pinned executable and fixtures.

## Earlier alpha.1 native smoke check

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

The alpha.1 compiled npm-format tarball was installed in a separate temporary directory
without this repository's development dependencies. Its installed CLI ran the
offline demo successfully. The distribution file list was checked to exclude
private snapshots, schema dumps, and node_modules.

## Still unverified

- Live capture on other Codex versions, OS/architecture combinations, or Node
  releases beyond the two recorded above.
- Model selection, skill execution, performance improvement, or Desktop state.
- All managed settings, plugin backends, and remote environments.
- External user onboarding, real support-case impact, and repeat adoption.

The support manifest deliberately remains narrow until new live evidence and
conformance cases are available.
