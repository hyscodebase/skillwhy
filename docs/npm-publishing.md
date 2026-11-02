# npm distribution

Registry publication is pending. GitHub release tarballs remain the currently
available installation route. The `alpha` npm dist-tag below becomes usable only
after the first successful registry publication.

The package is prepared as `@hyscodebase/skillwhy`, with public access, an `alpha`
dist-tag, and `https://registry.npmjs.org` in its publication metadata. Confirm
that the npm account owns this namespace before the first publication.

## First publication

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

Configure the package's npm Trusted Publisher with:

| Field | Value |
| --- | --- |
| Organization or user | `hyscodebase` |
| Repository | `skillwhy` |
| Workflow filename | `npm-publish.yml` |
| Allowed action | Direct `npm publish` |

The manual **npm distribution** workflow accepts an existing prerelease tag on
`main`. Its default `publish: false` runs tag validation, the shared CI matrix,
a compiled-package installation smoke test, and `npm publish --dry-run`.
No registry version is created in that mode. To publish after account setup,
dispatch from that exact tag with `publish: true`, for example:

```sh
gh workflow run npm-publish.yml --ref v0.1.0-alpha.3 \
  -f release_tag=v0.1.0-alpha.3 -F publish=true
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
