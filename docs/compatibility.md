# Compatibility and evidence

SkillWhy's offline comparison, demo, and sharing use Node.js 22 or later. Native
capture is a separate compatibility surface.

Native capture admits **Codex CLI 0.166.0 on macOS arm64 and Linux x64**. Linux
evidence covers **Ubuntu 24.04 x64**, not every Linux distribution. Other CLI
versions or platform/architecture combinations produce an `unsupported` snapshot
instead of silently guessing. This is an early alpha, not a promise that every
configuration on an admitted combination works.

Actual alpha.2 metadata conformance runs passed on macOS arm64 with Node.js
**22.20.0** and **24.8.0**. They covered duplicate names, an explicitly disabled
temporary skill, a missing-description error, and capture → diff → share.
See the [validation record](validation.md) for exact fixtures, timestamps,
reproduction commands, and limits. Linux x64 was admitted after reviewing both
Node versions in the live Ubuntu 24.04
[candidate run](https://github.com/hyscodebase/skillwhy/actions/runs/41456035667).
The original Linux build still returned `unsupported` in that run; the ten cases
passed through its explicitly labeled temporary candidate copy. A subsequent
`supported` run checks the admitted, unmodified production build.

The adapter requests a fresh process's `skills/list` response. It does not attach
to an existing Desktop chat or read a model transcript. The native result does not
prove that a skill's description reached the model, that its body was read, or that
it executed. A CLI version change can change discovery behavior.

The official [App Server documentation](https://learn.chatgpt.com/docs/app-server)
describes initialization, `skills/list`, and reload behavior. The
[Skills documentation](https://learn.chatgpt.com/docs/build-skills) explains that
same-name skills are not universally merged into a single winner.

## Validation categories

- Unit and process tests use synthetic inputs and fake local processes.
- The default CI suite does not require Codex, a login, or paid API calls.
- Live observations, when performed, are recorded in the release validation notes
  with their exact CLI, Node, OS, scope, and limitations.
- A native live smoke check does not replace the entire compatibility suite or
  validate model invocation, Desktop state, or every plugin backend.

A `complete` capture reports completion of the requested native inventory, not
strict YAML/skill-specification validation. The host may accept metadata forms
that a separate linter rejects. Only errors returned by the host or detected by
the capture adapter can affect that status; SkillWhy does not independently lint
every SKILL.md.

Do not broaden the support manifest just because a newer version parses. Add
schema and discovery-semantic tests for that version first.

The opt-in `scripts/native-conformance.mjs --live` uses temporary fixtures and a
per-process configuration override, without editing user settings. It inherits
the current Codex environment and is not a network-isolation or managed-policy
test. A passing default CI job validates offline and fake-process behavior;
**it is not evidence of live Codex support on each CI operating system**.

## Native verification and candidate history

Production decisions are centralized in `src/compatibility.ts`. The two verified
Linux candidate summaries are preserved in
[the validation record](validation.md#alpha3-native-support-investigation).

Before admission, the source-checkout script's `--candidate linux-x64` mode
checked the original CLI's unsupported result and then ran the fixture suite
against a temporary copy with one compatibility-predicate override. Now that the
tuple is reviewed, that experimental mode refuses it with
`CANDIDATE_ALREADY_SUPPORTED` on Linux x64. Use the ordinary `--live` command.
There is no candidate flag or environment-variable bypass in the shipped CLI.
Historical `temporary-candidate` reports remain labeled as such.

The manually dispatched `Native conformance (opt-in)` workflow installs exactly
`@openai/codex@0.166.0` on Ubuntu 24.04 x64 and runs Node 22.20.0 and 24.8.0. Its
default `supported` mode tests the unmodified production manifest and should fail
on unapproved hosts. The historical candidate mode is retained but rejects this
already reviewed tuple. Only sanitized successful summaries are uploaded, with
the source revision.

Review both native job results, their ten fixture outcomes, and any limitations
before adding a production tuple. Keep unsupported versions and architectures
rejected. Container emulation, a matching response schema, and the default
offline CI matrix are useful preliminary checks but cannot substitute for that
evidence. Current observations and pending checks are recorded in
[validation.md](validation.md).
