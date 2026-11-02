# What is collected and shared

## Local capture

Capture starts the selected local Codex executable, checks its version, initializes
an app-server connection, and requests `skills/list` for the selected directory.
No model turns, skill scripts, configuration writes, installation, or repair
requests are sent by SkillWhy. This does not control Codex's own startup, cache,
logging, configuration, or network behavior.

The private snapshot retains only normalized metadata needed for comparison.
It can contain skill names and source paths. Treat it as private; do not attach it
to a public issue. Raw descriptions, settings, authentication, environment values,
transcripts, and stderr are not stored.

Fingerprints are opt-in with `capture --digest`. Only a regular, size-bounded
SKILL.md within the selected project may be read. Remote resources and skill
scripts are never fetched or executed. A matching SKILL.md hash says nothing
about the equality of other resources or model behavior.

## Single-entry share bundles

`share` requires an explicit entry selection and an explicit alias. The bundle is
built from an allowlist rather than by deleting a few fields from a private object.
Default exports omit original names, paths, IDs, descriptions, content hashes,
raw errors, and all unselected entries. They preserve the observation's limits.

`--include-name` and `--include-digest` disclose the selected values deliberately.
A hash can identify a known file; it is not anonymization. A chosen alias can also
reveal information. Preview and review what you choose to publish.

The same alias in two bundles is your explicit assertion that those entries
correspond. Missing/omitted fields remain unknown. A bundle is diagnostic evidence,
not an environment backup or a complete inventory.

## Files and transport

The tool creates output files exclusively with owner-only permissions and refuses
overwrites and symlink targets. It also rejects existing symlink parent paths;
use a real directory path when a platform exposes temporary folders through links.
These local checks are not an operating-system sandbox or a defense against a
privileged process racing changes to parent directories.

If writing or syncing an output fails, a partial owner-only file may remain.
SkillWhy does not delete it automatically because the path could have been
replaced concurrently. Inspect and remove the incomplete file yourself before
retrying, or choose a new output path.

There are no uploads, hosted accounts, default telemetry, or automatic GitHub
comments. The user decides whether and where to send an exported file.
