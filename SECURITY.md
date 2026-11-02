# Security and data handling

Do not include credentials, private skill bodies, raw logs, or conversations in
public reports. For a sensitive issue, use GitHub's private vulnerability reporting
on this repository when available. Otherwise open an issue containing only a
request for a private contact method, without the sensitive details.

SkillWhy does not execute skill scripts or request model turns. Native capture
starts a local Codex executable chosen by the user; that executable retains its
own startup behavior. Use a trusted local executable.

Snapshot files are private diagnostic artifacts. Share exports use a field
allowlist and explicit entry selection. They reduce data exposure but do not
guarantee that every user-selected label or opted-in value is safe to publish.

Only documented CLI/OS combinations are supported for capture. This project is
an early alpha, not a security audit or a verification of model behavior.
