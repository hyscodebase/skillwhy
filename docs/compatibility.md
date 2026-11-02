# Compatibility and evidence

SkillWhy's offline comparison, demo, and sharing use Node.js 22 or later. Native
capture is a separate compatibility surface.

The initial adapter targets **Codex CLI 0.166.0 on macOS arm64**. Other versions or
platforms produce an `unsupported` snapshot instead of silently guessing. This is
an early alpha, not a promise that every configuration on that combination works.

Actual alpha.2 metadata conformance runs passed on this combination with Node.js
**22.20.0** and **24.8.0**. They covered duplicate names, an explicitly disabled
temporary skill, a missing-description error, and capture → diff → share.
See the [validation record](validation.md) for exact fixtures, timestamps,
reproduction commands, and limits. This evidence does not add another supported
Codex version or operating system.

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

## Candidate platform checks

Production decisions are centralized in `src/compatibility.ts`. Codex
0.166.0/Linux x64 is currently an unapproved candidate; normal capture still
returns `unsupported` there.

The source-checkout script accepts `--candidate linux-x64` only on Linux x64.
It checks the original CLI's unsupported result, then runs the live fixture suite
against a temporary copy of the build with one compatibility-predicate override.
There is no candidate flag or environment-variable bypass in the shipped CLI.
The report labels this as `temporary-candidate`; it must not be presented as a
production compatibility result.

The manually dispatched `Native conformance (opt-in)` workflow installs exactly
`@openai/codex@0.166.0` on Ubuntu 24.04 x64 and runs Node 22.20.0 and 24.8.0. Its
`candidate-linux-x64` mode tests this temporary copy. The `supported` mode instead
tests the unmodified production manifest and should fail on unapproved hosts.
Only sanitized successful summaries are uploaded, with the source revision.

Review both native job results, their ten fixture outcomes, and any limitations
before adding a production tuple. Keep unsupported versions and architectures
rejected. Container emulation, a matching response schema, and the default
offline CI matrix are useful preliminary checks but cannot substitute for that
evidence. Current observations and pending checks are recorded in
[validation.md](validation.md).
