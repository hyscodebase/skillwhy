# Reading an incomplete result

`capture` and `diff` exit with code 2 when they cannot establish a complete result.
The private snapshot is still useful for local investigation. Choose a new output
filename when recapturing; SkillWhy never overwrites an existing file.

| Observation | Next step |
| --- | --- |
| `unsupported` | Check [the compatibility table](compatibility.md). `--codex-bin PATH` selects an existing local executable; the offline `demo` works without Codex. |
| `HOST_NOT_FOUND` | Check the executable is installed and available, or select it explicitly. A successful version probe alone does not establish native compatibility. |
| `CWD_UNAVAILABLE` / `CWD_NOT_DIRECTORY` | Point `--cwd` to an existing local project directory. |
| `NATIVE_SKILL_ERRORS` | Review local SKILL.md metadata, especially missing required descriptions. The host reported an error, so the returned inventory is partial. Raw native error messages are not exported. |
| `VERSION_TIMEOUT` / `HOST_TIMEOUT` | Check the selected executable. If startup is slow, retry with `--timeout-ms 60000` and a new output file. |
| `unknown` entries in a private diff | If the project roots truly correspond, explicitly select them with `--map-root project=project`. To compare one entry, create selected shares with a confirmed common alias. |
| Duplicate skill names | Use `inspect FILE --skill NAME`, then choose an individual `--entry ID` for sharing. |
| Missing fingerprint | Capture with `--digest` if needed. Only regular project-local SKILL.md files can be hashed; unreadable or outside-scope content stays unknown. |
| Cannot write a snapshot | Use a new filename in an existing directory. Symlink paths and overwriting are refused. |

These steps address metadata collection and correspondence. A matching discovery
result does not prove that a model selected, read, or executed a skill.

For help, report the command, tool versions, and safe status/error codes in a
[bug report](https://github.com/hyscodebase/skillwhy/issues/new?template=bug_report.yml).
Use a reviewed selected share if an example is needed. Keep raw private snapshots
and source paths local.
