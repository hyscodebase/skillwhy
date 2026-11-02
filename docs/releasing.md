# GitHub prereleases

SkillWhy's release workflow builds a downloadable npm tarball and `SHA256SUMS` on GitHub. It does **not** publish to the npm registry and needs no npm token or personal access token. It uses the repository's temporary `GITHUB_TOKEN`; only the publishing job receives `contents: write`.

## Prepare and trigger

1. Change the version in `package.json` and both version fields in `package-lock.json`. `src/version.ts` reads the installed package metadata, so there is no second CLI version constant to update.
2. Update the changelog and compatibility evidence. Run `npm ci`, `npm test`, and `npm run typecheck`. `npm test` includes the release gate and publication state tests.
3. Merge the release commit into `main`. Wait for the normal branch CI, then tag that exact commit, for example `git tag -a v0.1.0-alpha.3 -m 'SkillWhy 0.1.0-alpha.2'` and `git push origin v0.1.0-alpha.3`.
4. Watch **GitHub prerelease** in Actions. The release becomes public only after workflow lint, all four Linux/macOS × Node 22/24 jobs, and the packaged installation smoke checks pass.

Tag pushes matching `v*` trigger the workflow. The tag must equal `v` plus the package version, point to the checked out/event commit, and already be an ancestor of `origin/main`. Annotated and lightweight tags both work. Only prerelease versions such as `0.1.0-alpha.2` are accepted; stable versions and build metadata are deliberately rejected until a stable-release policy is added. A prerelease is never marked as the repository's latest stable release.

The release workflow calls the same reusable `ci.yml` used by branch pushes and pull requests. Its workflow lint job runs before the shared test matrix, so there is one matrix to maintain. Tag pushes run this gate through the release workflow instead of starting a second standalone CI run. The release workflow also reruns the version and ancestry gate in the publishing job; immediately before publishing, the API checks the current tag target and reachability from `main` again.

Other repository workflows can call `./.github/workflows/ci.yml` with an optional `ref` input after validating that source commit or tag. Both lint and matrix jobs check out that ref; without it, they use the event commit. A selected historical ref must contain `scripts/lint-workflows.mjs` and the shared checks. This does not silently substitute current source for an older release.

## What is verified

- `node scripts/lint-workflows.mjs` downloads [actionlint v1.7.11](https://github.com/rhysd/actionlint/releases/tag/v1.7.11), verifies the archive against a pinned official SHA-256, and checks every `.github/workflows/*.yml` or `*.yaml` file. It also runs the real linter against an invalid job-level `runner.temp` fixture and its valid step-level replacement. This catches context availability errors that application tests cannot detect. Optional shellcheck/pyflakes integration is disabled so this gate has the same workflow semantics on local machines and CI; it is not a shell or Python code lint pass.
- Package and lockfile name/version agree with the tag.
- Unit/integration tests, release state tests, type checking, and pack preview pass on Ubuntu/macOS with Node 22/24.
- A fresh build is packed outside the checkout. Its tarball is installed into a newly created temporary prefix with install scripts disabled.
- The installed binary reports the exact package version and `demo --json` produces a complete, synthetic comparison with an enabled-state difference. No Codex installation, API key, or model call is needed for this smoke test.
- SHA-256 is computed locally. Both the tarball and `SHA256SUMS` are uploaded to a draft, then their remote sizes, upload states, and GitHub-reported SHA-256 digests are checked before publication.

These checks establish packaging and tested behavior, not additional native Codex compatibility. See [compatibility.md](compatibility.md) for the native combinations actually validated. The checksums detect changes to the assets; they are not an independent signature or provenance attestation.

Dependabot proposes grouped npm and GitHub Actions updates each Monday; this configuration does not enable automatic merging. Review their CI results before merging. The actionlint binary version and archive hashes are separately pinned in `scripts/lint-workflows.mjs`; update those together from the official release when changing the linter.

For a local packaging rehearsal, use a new directory outside the repository:

```sh
npm ci
RELEASE_DIR="$(mktemp -d)/assets" node scripts/release-build.mjs
```

The command prints a manifest of the two assets. It installs only into a temporary prefix and does not publish anything. `RELEASE_DIR` must not already exist; keeping old artifacts in place causes a failure instead of silently reusing them. The temporary installed prefix is removed; the requested output directory remains for inspection. Version/tag ancestry is checked separately by `RELEASE_TAG=v0.1.0-alpha.3 node scripts/release-check.mjs` after creating the tag.

## Install a release asset

Download the `.tgz` file and `SHA256SUMS` from the same GitHub prerelease. In their directory, verify the checksum before installation:

```sh
shasum -a 256 -c SHA256SUMS
npm install --prefix ./skillwhy-install --ignore-scripts --no-audit --no-fund ./hyscodebase-skillwhy-0.1.0-alpha.3.tgz
./skillwhy-install/node_modules/.bin/skillwhy --version
./skillwhy-install/node_modules/.bin/skillwhy demo
```

Use the filename/version belonging to the release you downloaded. Linux also provides `sha256sum -c SHA256SUMS`. This is a GitHub asset installation; `npx @hyscodebase/skillwhy` requires a separate npm registry publication and is not part of this workflow.

## Failures and retries

Runs for one tag are serialized and are not automatically cancelled. Network reads have bounded retries; writes are not blindly retried. If a request times out after GitHub accepted it, rerun the failed Actions run to reconcile the existing state.

- **Before a draft exists:** fix the problem. If source changes are needed, use a new version and tag; do not move a release tag.
- **Partial draft:** a rerun resumes only a draft with the exact automation body, commit, and asset checksums. Already uploaded, matching assets are retained; missing assets are uploaded. A failed or conflicting upload is never deleted or overwritten automatically. Inspect the draft manually; if it is demonstrably an unpublished failed automation draft, a maintainer may remove it before retrying, or choose a new version/tag.
- **Already published:** an identical release with both verified assets is a read-only success. Missing assets, changed checksums, manual releases with the same tag, and unexpected extra assets cause failure. The workflow never edits a published release, replaces an asset, or deletes a release/tag. Publish a new version to fix released contents.
- **The tag target changed or the release commit is no longer reachable from `main`:** publication stops. Any uploaded assets remain in a draft for maintainer inspection. Normal new commits on `main` are allowed while the release commit remains its ancestor.

The automation uses the existing CI's pinned checkout/setup-node actions with checkout credential persistence disabled. The token is passed only to the publication command. Publication uses fixed GitHub API hosts, bounded request timeouts, and no release-body or server-error logging that could expose credentials. There is no environment approval, signing key, npm publication, or automatic release discussion in this workflow.

GitHub's [release API](https://docs.github.com/en/rest/releases/releases), [asset API](https://docs.github.com/en/rest/releases/assets), and [workflow token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) describe the API fields and permissions used here.
