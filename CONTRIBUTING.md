# Contributing

Start with a reproducible, sanitized fixture or a documentation improvement.
Before adding a new host or CLI version, discuss its discovery contract and the
maintenance burden in an issue. A successful JSON parse alone does not establish
compatibility.

Use Node.js 22 or later, run `npm ci`, then `npm test` and `npm run typecheck`.
Tests must distinguish synthetic fixtures, fake native processes, and observations
from a real host. Do not use paid model calls in the default test suite.

Live conformance is opt-in and separate from CI. Follow [the validation notes](docs/validation.md)
for the fixture runner and its supported Codex version. A new version or platform
must have recorded native evidence before it joins the capture allowlist; the
ordinary Node.js test matrix does not establish native host compatibility.

For package versions, tags, release checks, and recovery from failed publishing,
see [release maintenance](docs/releasing.md). Package metadata is the single source
of the CLI, adapter, and protocol client version.

Preserve same-name entries and unknown states. Do not add automatic installation,
configuration repair, uploads, raw logs, or transcript collection.

Never attach private snapshots, credentials, skill bodies, or account data to a
public issue. Prefer a hand-written fixture or a reviewed single-entry share
bundle. State the supported version, OS, command, and expected observation.
