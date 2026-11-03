# npm distribution

The public [npm package](https://www.npmjs.com/package/@hyscodebase/skillwhy) is
available. The initial `0.1.0-alpha.3` publication and an isolated public registry
installation were verified on 2026-11-03; see [the validation record](validation.md#public-npm-installation).
Use `npx --yes @hyscodebase/skillwhy@alpha demo` for the offline demo.

The package is published as `@hyscodebase/skillwhy`, with public access, an `alpha`
dist-tag, and `https://registry.npmjs.org` in its publication metadata. The namespace owner performed the initial interactive publication.

## Initial publication procedure

1. Authenticate interactively with `npm login --registry=https://registry.npmjs.org`.
   Complete npm's account verification in your own browser. Credentials and
   one-time codes do not belong in an issue or chat.
2. Download the intended GitHub release tarball and `SHA256SUMS`, then verify the
   checksum as described in [release maintenance](releasing.md).
3. From the downloaded files' directory, run
   `npm publish --ignore-scripts --access public --tag alpha ./hyscodebase-skillwhy-VERSION.tgz`,
   replacing `VERSION` with the actual prerelease version. npm may request account
   verification. This publishes the compiled tarball that was reviewed and tested.
4. Verify `npm view @hyscodebase/skillwhy dist-tags` and run
   `npx --yes @hyscodebase/skillwhy@alpha demo` from a clean directory. Only then
   change the main README to recommend the registry command.

These are account setup and distribution steps; they do not change native Codex
compatibility. [npm's scoped package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
describes namespace ownership, public visibility, and account verification.

## Subsequent releases from GitHub Actions

The package's npm Trusted Publisher is configured with:

| Field | Value |
| --- | --- |
| Organization or user | `hyscodebase` |
| Repository | `skillwhy` |
| Workflow filename | `npm-publish.yml` |
| Allowed action | Direct `npm publish` (and npm's implicit `npm stage publish`) |
| Environment name | None |

The manual **npm distribution** workflow accepts an existing prerelease tag on
`main`. Its default `publish: false` runs tag validation, the shared CI matrix,
a compiled-package installation smoke test, and `npm publish --dry-run`.
No registry version is created in that mode. To publish after account setup,
dispatch from that exact tag with `publish: true`, for example:

```sh
RELEASE_TAG=vX.Y.Z-alpha.N # Replace with the next unpublished prerelease.
gh workflow run npm-publish.yml --ref "$RELEASE_TAG" \
  -f release_tag="$RELEASE_TAG" -F publish=true
```

Real publication requires both the dispatch ref and event commit to match the
selected tag. npm's automatically generated provenance uses the event commit;
running from `main` while building a different tag would misidentify the source.
Dry runs can select a tag while dispatching from `main` because nothing is
published in that mode.

The selected commit must contain this workflow and the shared CI lint scripts;
alpha.2 and earlier tags predate them. npm publishing uses an OIDC identity from
GitHub-hosted runners rather than a repository-stored npm write token. The
workflow uses Node 24 and checks the required npm CLI version. Follow the
[official Trusted Publishing instructions](https://docs.npmjs.com/trusted-publishers/)
when configuring the package; a successful dry run does not prove npm publishing
authorization is configured.

A newly created connection must complete its first successful publication within
2 days. The connection was saved on 2026-11-03; its first real OIDC publication is
still pending. Do not treat saving the form or a dry run as successful registry
authorization. Once a version is published, use a new version and tag for the
next attempt that changes package contents; do not replace published versions.

## Availability after publication

npm can accept a publication before the version becomes installable. Its
[publish-time scanning announcement](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)
describes a typical delay of a few minutes, which can take longer. An immediate
404 after a successful publish is not evidence that the version can be safely
republished. Check the existing version and its integrity again before any retry.
The initial alpha.3 request returned HTTP 202 and became publicly installable
before the clean-install checks above.
