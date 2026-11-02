# Weekly evidence record

The **Weekly public adoption record** workflow runs each Monday at 01:23 UTC
(10:23 Korea time), or through a manual Actions run. It reads public GitHub API
aggregates, adds a job summary, and retains Markdown/JSON artifacts for 30 days.
It posts no issue or comment, modifies no repository file, and adds no CLI
telemetry. Scheduled runs may be delayed by GitHub.

## Read the weekly table

Each report names the repository, observation start/end time, and API sources.
These are cumulative snapshots; subtracting successive observations is a manual
comparison, not a claim that the workflow measured seven days of usage.

| Weekly field | What it counts | What it cannot establish |
| --- | --- | --- |
| Stars / forks | Current public repository totals | Users, successful runs, retention |
| External pilot issues | Open and closed `[Pilot]` issues or issues labeled `pilot`; excludes PRs, the repository owner/`OWNER` association, and bots | Distinct people, completed pilots, willingness, helpfulness |
| Release tarball downloads | `download_count` summed across `.tgz`/`.tar.gz` assets on public releases, including prereleases | Unique users, installs, executions, npm downloads; maintainer/CI/repeat downloads are included |
| Reviewed evidence records | Explicit maintainer-reviewed entries in the manual register | Total adoption, independent experimental validation, or population-wide results |

Pilot reports include an explicit denominator: all matching issues before the
owner/bot exclusion, the excluded count, and all non-PR public issues scanned.
Only counts and up to 25 issue URLs are retained; titles, bodies, usernames, and
raw API responses are not republished. HTTP errors, malformed responses, or
pagination limits produce **unknown**, never a fabricated zero. A zero is shown
only for a successfully observed zero or the count of entries in a valid empty
manual register. Public API reads are bounded to 10 seconds per request, 50 pages
per collection, and 200 requests per run. A failed source does not erase
successful other sources.

## Record actual outcomes manually

The initial [manual register](adoption-records.json) has **0 evidence records**.
Actual use, repeat use, and problem resolution are **unknown**, not zero.
Do not infer them from stars, downloads, an issue's existence, or a stated intention
to try the tool. No growth or conversion target is forecast by this report.

After reviewing a public, participant-approved account, a maintainer may add an
entry with exactly these fields to `records`:

```json
{
  "date": "YYYY-MM-DD",
  "evidenceUrl": "https://github.com/OWNER/REPO/issues/NUMBER#issuecomment-ID",
  "outcome": "first-live-use",
  "externalParticipantConfirmed": true,
  "maintainerConfirmed": true,
  "publicSummaryApproved": true
}
```

This is a schema example, not an observed outcome. `outcome` is one of
`first-live-use`, `repeat-use`, or `problem-helped`. Keep synthetic demo feedback
separate from first live use. Confirm at least two actual uses for repeat use;
for helpfulness, require the participant's concrete description of what the
report helped resolve. A willingness answer alone qualifies for none of these.
Use the date of the described event, confirm that the participant is external,
and link only an intentionally public summary. Do not add names, private paths,
raw snapshots, or secrets. The same URL/outcome pair cannot be counted twice.
One person can contribute multiple records; the output therefore says **records**,
not unique users. Evidence is a reviewed report, not a controlled causal test.

To rehearse the public read locally, use `node scripts/adoption-report.mjs`.
`GH_TOKEN` is optional for public API rate limits. Set `ADOPTION_REPORT_DIR` to a
new directory to save JSON and Markdown; existing directories are not reused.
The workflow uses only `contents: read`. Missing permission or rate-limit errors
stay visible as unknown; the script does not increase token permissions.

Sources: GitHub's [repository API](https://docs.github.com/en/rest/repos/repos#get-a-repository),
[issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues), and
[release assets API](https://docs.github.com/en/rest/releases/assets#list-release-assets).
