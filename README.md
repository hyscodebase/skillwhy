# SkillWhy

**Same repo. Different skills. Find the difference.**

SkillWhy compares the skills that fresh Codex CLI processes discover. Capture two local environments, inspect their differences, and prepare a small support bundle without sharing your full configuration.

**Early alpha.** Native discovery is limited to explicitly supported CLI and OS versions. A discovered or enabled skill is **not proof that a model read or executed it**. An existing Desktop session is not inspected.

## Try the offline demo

Requires Node.js 22 or later. From a checkout:

```sh
npm ci
npm run demo
```

Or run the compiled GitHub alpha package (not an npm registry release):

```sh
npx --yes --package https://github.com/hyscodebase/skillwhy/releases/download/v0.1.0-alpha.1/hyscodebase-skillwhy-0.1.0-alpha.1.tgz skillwhy demo
```

The demo uses synthetic snapshots. It needs no Codex installation, API key, or model call.

```text
SkillWhy · skill discovery comparison
SYNTHETIC EXAMPLE — NOT A LIVE SCAN

key:demo:release-review · enabled-changed
  true → false [observed]

Model selected/read/executed a skill: NOT OBSERVED
Existing Desktop session: NOT ASSESSED
```

## Capture and compare

```sh
node dist/src/cli.js capture --agent codex --cwd ./my-project --out local.snapshot.json
node dist/src/cli.js diff before.snapshot.json after.snapshot.json \
  --map-root project=project --detail
```

Capture asks a new local Codex process for metadata only. It sends no model turns or configuration writes. The native process can still have its own startup, cache, logging, and network behavior. Read the [compatibility notes](docs/compatibility.md).

`--map-root project=project` explicitly confirms which roots correspond and limits comparison to those roots. Unselected global entries are counted as unassessed. SkillWhy preserves same-name copies, reports ambiguous matches, and keeps missing evidence unknown. It does not choose a winner or infer model routing.

Optional `--digest` fingerprints only `SKILL.md` files within the selected project. Matching fingerprints do not establish equality of scripts, dependencies, or behavior.

## Share one selected skill

```sh
node dist/src/cli.js share --snapshot local.snapshot.json \
  --skill release-review --alias review --preview
node dist/src/cli.js share --snapshot local.snapshot.json \
  --skill release-review --alias review --out local.share.json
node dist/src/cli.js diff maintainer.share.json local.share.json --detail
```

Use the same explicit alias only for entries you have confirmed correspond. If names are duplicated, select an `--entry` ID from your private snapshot. This alpha exports one entry per bundle.

By default, bundles exclude skill names, bodies, descriptions, source paths, fingerprints, logs, and unselected entries. `--include-name` and `--include-digest` are explicit opt-ins. Preview the file before sharing it yourself; the tool never uploads it. See [data handling](docs/privacy.md).

## What the result means

| Result | Meaning |
| --- | --- |
| `enabled-changed` | The two observations report different enabled values |
| `content-changed` | Collected SKILL.md fingerprints differ |
| `unknown` | A required observation or shared field is missing |
| `ambiguous-match` | Multiple entries could correspond; none was guessed |
| `inconclusive` | The comparison could not establish a complete result |

Exit `0` means the command completed; differences are normal. Exit `2` means input, collection, compatibility, or comparison was inconclusive. This alpha is not an automatic CI policy gate.

## Why another tool?

[skillscope](https://github.com/heidihowilson/skillscope) provides multi-host inspection. [coding-agent-skills](https://github.com/EJRyan89/coding-agent-skills/blob/main/docs/codex-support.md) already verifies native discovery and catalog exposure. SkillWhy focuses on a small, inspectable comparison and support-file workflow. It does not claim a new discovery algorithm.

## Development

```sh
npm ci
npm test
npm run typecheck
```

No runtime dependencies. Tests use synthetic records and local fake subprocesses; live compatibility observations are documented separately. [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [한국어](docs/README.ko.md) · [Roadmap](docs/roadmap.md)

MIT licensed. No default telemetry, accounts, or hosted service.
