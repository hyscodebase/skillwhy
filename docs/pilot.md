# A 10-minute self-serve pilot

**2026-11-02 baseline: 0 completed external pilots recorded.** This procedure is
not evidence of adoption or time saved. Stop after ten minutes, even if blocked.

## 1. Try the demo (about 2 minutes)

With Node.js 22 or later and Git:

```sh
npx --yes github:hyscodebase/skillwhy#v0.1.0-alpha.3 demo
```

The initial download/build needs internet access. The synthetic demo needs no
Codex, API key, or model call. **Demo-only feedback is welcome and is kept separate
from live native observations.** Note your approximate time to first success.

## 2. Try your own snapshot, if already supported (about 5 minutes)

Live capture supports **Codex CLI 0.166.0 on macOS arm64 only**. Check your existing
environment with `codex --version`; use `node --version` and
`node -p "process.platform + '/' + process.arch"` for the other runtime details.
If unsupported or absent, finish with demo feedback. Do not install, upgrade, or
downgrade Codex for this pilot.

If you do not already have SkillWhy installed, use the compiled release:

```sh
npm install --global https://github.com/hyscodebase/skillwhy/releases/download/v0.1.0-alpha.3/hyscodebase-skillwhy-0.1.0-alpha.3.tgz
skillwhy --version
```

Use an existing skill project. Replace `./my-project`, then choose one returned ID:

```sh
skillwhy capture --cwd ./my-project --out pilot.snapshot.json
skillwhy inspect pilot.snapshot.json
# Replace ENTRY_ID with the exact ID of the one entry you chose:
skillwhy share --snapshot pilot.snapshot.json --entry ENTRY_ID --alias pilot-review --preview
```

To filter duplicate names, add `--skill YOUR_SKILL_NAME` to `inspect`; choose one
ID. An empty result is also feedback. Keep the snapshot and inspection local:
they contain private metadata. Use a new filename if an output already exists.

Capture requests fresh CLI metadata, not model turns or skill execution. Codex
can still perform its own startup/cache/network activity. Preview uploads nothing.

## 3. Optional: compare two environments

If a second environment is available, each person selects their entry and
**separately confirms that the entries correspond** before choosing the same
neutral `--alias`. SkillWhy does not establish this association for you.

After reviewing both previews, replace `--preview` with `--out local.share.json`
and `--out other.share.json` respectively. Exchange only reviewed bundles, then:

```sh
skillwhy diff local.share.json other.share.json --detail
```

This compares selected observations, not model behavior. This step is optional.

## 4. Optionally share your feedback (about 3 minutes)

Optionally publish a **sanitized summary** using the
[pilot report form](https://github.com/hyscodebase/skillwhy/issues/new?template=pilot_report.yml):
runtime versions, demo versus live attempt, time to first success, blocked step,
whether it helped your problem, and whether you would use it again. Estimates and
unsuccessful attempts are useful; no successful outcome is assumed.

Do not attach raw snapshots, configuration, skill bodies, private paths, API keys,
or secrets. No attachment is needed. Nothing is sent automatically; filing an
issue is your choice.

Maintainers can use the [interview guide](interviews.md) to record the problem,
whether assistance was needed, and the participant's interpretation of the result.
See [troubleshooting](troubleshooting.md) for incomplete captures or comparisons.
