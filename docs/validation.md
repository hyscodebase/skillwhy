# Alpha validation record

Updated: 2026-11-03. These observations are scoped engineering checks, not a claim
of production readiness, adoption, or model accuracy.

## Public npm installation

On 2026-11-03, `@hyscodebase/skillwhy@0.1.0-alpha.3` became available from the
public npm registry. Its registry SHA-1 and SHA-512 integrity matched the compiled
GitHub release tarball; that file's SHA-256 is
`7e87ba34b8da5fca027cd5eb54e7aa796b27ec536e19f9eb4cdcd8f8221a3fcd`.

An installation into a new temporary prefix, with a new cache and empty user and
global npm configuration, reported `0.1.0-alpha.3` and ran `demo --json` with
`status: complete`. An isolated `npm exec --package=@hyscodebase/skillwhy@alpha`
demo produced the same JSON. These checks used Node 24.8.0 and npm 11.11.0 on
macOS arm64, with no registry login available to the installation process.
This establishes public package distribution and the offline demo, rather than
additional native Codex compatibility or external adoption.

## Alpha.3 native support investigation

After extracting the production compatibility manifest, the existing macOS arm64
suite passed again against Codex 0.166.0:

| Adapter | Node.js | Build mode | Checked at (UTC) | Result |
| --- | --- | --- | --- | --- |
| 0.1.0-alpha.3 | 22.20.0 | Production | 2026-11-02 13:28:20 | Ten reported checks passed. |
| 0.1.0-alpha.3 | 24.8.0 | Production | 2026-11-02 13:30:46 | Ten reported checks passed. |

Linux x64 was admitted to the production manifest after review of the live
Ubuntu 24.04 x64 candidate results below. The exact `@openai/codex@0.166.0` package
and its normal npm launcher were used. Package availability and schema parsing
alone were not used as evidence of working discovery.

An initial Docker `linux/amd64` run on Apple Silicon used Node 22.20.0 and that
exact package. The native phase ran with `--network none`, a read-only root, and
temporary writable directories, after package installation. It failed with
`CAPTURE_HOST_SHUTDOWN_FORCED`. The failure remains a failure: the experiment did
not relax capture completion rules, grant Linux support, or establish whether
emulation, the npm launcher, or another shutdown behavior caused the result.

The separate, opt-in [native workflow run 41456035667](https://github.com/hyscodebase/skillwhy/actions/runs/41456035667)
completed successfully on Ubuntu 24.04 x64 at source commit
`edba794da48015dfff0c31c87a8ab9423c6ac32e`:

| Node.js | Checked at (UTC) | Build mode | Result and preserved summary |
| --- | --- | --- | --- |
| 22.20.0 | 2026-11-02 13:47:57 | Temporary candidate | [Ten checks passed](native-evidence/candidate-run-41456035667-node-22.20.0.json). |
| 24.8.0 | 2026-11-02 13:47:53 | Temporary candidate | [Ten checks passed](native-evidence/candidate-run-41456035667-node-24.8.0.json). |

Both downloaded artifacts contained exactly one `native-summary.json`. Each was
checked for the fixed 15-field shape, exact CLI/adapter/runtime versions, source
commit, Linux x64 platform, ten expected cases, and `productionSupported: false`.
These public-safe summaries are retained here because Actions artifacts expire.
They contain no raw inventory, user paths, settings, prompts, or native stderr.
The artifacts were 13145699934 (Node 22) and 13147151229 (Node 24).

The candidate mode first checked that the original CLI returned `unsupported`.
It then copied the compiled CLI to a temporary directory and replaced only that
copy's compatibility predicate to admit Codex 0.166.0/Linux x64. The same ten live
fixture checks ran through this copy; production source and the original build
were unchanged. These are candidate results, not unmodified-production results.
After manifest admission, the workflow defaults to `supported`; its production
verification was recorded separately below.

The [production run 41457521197](https://github.com/hyscodebase/skillwhy/actions/runs/41457521197)
passed on Ubuntu 24.04 x64 at source commit
`e3b023d516645f251f83f9abdcdc5ffcdef5466c`, using the unmodified compatibility
manifest and normal npm Codex launcher:

| Node.js | Checked at (UTC) | Build mode | Result and preserved summary |
| --- | --- | --- | --- |
| 22.20.0 | 2026-11-02 13:58:12 | Production | [Ten checks passed](native-evidence/production-run-41457521197-node-22.20.0.json). |
| 24.8.0 | 2026-11-02 13:58:19 | Production | [Ten checks passed](native-evidence/production-run-41457521197-node-24.8.0.json). |

Both downloaded production artifacts were independently checked for the same
fixed field/case lists, exact source revision and versions, `buildMode: production`,
`candidateTarget: null`, and `productionSupported: true`. No experimental
compatibility override was applied in these production checks.

This workflow is manually dispatched, uses no supplied login or model API
credentials, and requests no model turns. It is separate from the default CI
matrix. Native startup in the workflow is not network-isolated. These successful
results cover Ubuntu 24.04 x64 and the listed fixtures rather than all Linux
distributions or managed configurations. The normal npm launcher passed here,
so the earlier emulation failure does not establish a general launcher defect;
its precise cause remains undetermined.

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

- Live capture on other Codex versions, Linux distributions beyond Ubuntu 24.04,
  other OS/architecture combinations, or Node releases beyond the two recorded
  above.
- Model selection, skill execution, performance improvement, or Desktop state.
- All managed settings, plugin backends, and remote environments.
- External user onboarding, real support-case impact, and repeat adoption.

The support manifest deliberately remains narrow until new live evidence and
conformance cases are available.
