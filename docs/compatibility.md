# Compatibility and evidence

SkillWhy's offline comparison, demo, and sharing use Node.js 22 or later. Native
capture is a separate compatibility surface.

The initial adapter targets **Codex CLI 0.166.0 on macOS arm64**. Other versions or
platforms produce an `unsupported` snapshot instead of silently guessing. This is
an early alpha, not a promise that every configuration on that combination works.

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

Do not broaden the support manifest just because a newer version parses. Add
schema and discovery-semantic tests for that version first.
