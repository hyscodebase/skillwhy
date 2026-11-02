import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API = "https://api.github.com";
const MAX_PAGES = 50;
const PAGE_SIZE = 100;
const OUTCOMES = ["first-live-use", "repeat-use", "problem-helped"];
class ReportError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const invalid = () => { throw new ReportError("INVALID_RESPONSE"); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const record = value => value !== null && typeof value === "object" && !Array.isArray(value) ? value : invalid();
const unknown = (source, code) => ({ status: "unknown", value: null, source, reason: code });

/** Only public GitHub read endpoints are called; errors never include response bodies. */
export function githubReader({ token, fetchImpl = fetch, timeoutMs = 10_000, maxRequests = 200 } = {}) {
  let requests = 0;
  return async path => {
    if (!path.startsWith("/repos/") || /[\r\n]/u.test(path)) throw new ReportError("INVALID_API_PATH");
    if (++requests > maxRequests) throw new ReportError("REQUEST_LIMIT");
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "skillwhy-adoption-report",
          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch { throw new ReportError("FETCH_FAILED"); }
    if (!response.ok) throw new ReportError(`HTTP_${response.status}`);
    if (!response.body) throw new ReportError("EMPTY_RESPONSE");
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) throw new ReportError("RESPONSE_TOO_LARGE");
        chunks.push(chunk);
      }
    } catch (error) { throw error instanceof ReportError ? error : new ReportError("FETCH_FAILED"); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new ReportError("INVALID_JSON"); }
  };
}

async function pages(read, path, maxPages) {
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const rows = await read(`${path}${path.includes("?") ? "&" : "?"}per_page=${PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(rows) || rows.length > PAGE_SIZE) invalid();
    for (const row of rows) {
      record(row);
      const id = count(row.id);
      if (seen.has(id)) throw new ReportError("INCONSISTENT_PAGINATION");
      seen.add(id);
      items.push(row);
    }
    if (rows.length < PAGE_SIZE) return items;
  }
  throw new ReportError("PAGINATION_LIMIT");
}

async function measure(source, operation) {
  try { return { status: "observed", source, ...(await operation()) }; }
  catch (error) { return unknown(source, error instanceof ReportError ? error.code : "FETCH_FAILED"); }
}

export function manualEvidence(value) {
  const root = record(value);
  if (Object.keys(root).some(key => !["schemaVersion", "records"].includes(key)) || root.schemaVersion !== 1 || !Array.isArray(root.records) || root.records.length > 1_000) invalid();
  const byOutcome = Object.fromEntries(OUTCOMES.map(outcome => [outcome, 0]));
  const seen = new Set();
  const evidence = root.records.map(item => {
    record(item);
    const keys = ["date", "evidenceUrl", "outcome", "externalParticipantConfirmed", "maintainerConfirmed", "publicSummaryApproved"];
    if (Object.keys(item).length !== keys.length || Object.keys(item).some(key => !keys.includes(key)) ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(item.date) || !Number.isFinite(Date.parse(item.date)) ||
        new Date(item.date).toISOString().slice(0, 10) !== item.date || !OUTCOMES.includes(item.outcome) ||
        item.externalParticipantConfirmed !== true || item.maintainerConfirmed !== true || item.publicSummaryApproved !== true) invalid();
    let url;
    try { url = new URL(item.evidenceUrl); } catch { invalid(); }
    if (url.protocol !== "https:" || url.username || url.password || typeof item.evidenceUrl !== "string" || item.evidenceUrl.length > 2_048) invalid();
    const key = `${item.evidenceUrl}\n${item.outcome}`;
    if (seen.has(key)) throw new ReportError("DUPLICATE_MANUAL_EVIDENCE");
    seen.add(key);
    byOutcome[item.outcome] += 1;
    return { date: item.date, evidenceUrl: item.evidenceUrl, outcome: item.outcome };
  });
  return { status: evidence.length ? "manual-evidence" : "unknown", recordedEvidenceCount: evidence.length,
    byOutcome: evidence.length ? byOutcome : null,
    reason: evidence.length ? "Counts are reviewed evidence records, not unique users or total usage." : "No manual evidence records; actual use, repeat use, and helpfulness need review.", evidence };
}

export async function collectAdoption({ repository, read = githubReader(), manualRecords = { schemaVersion: 1, records: [] }, now = () => new Date(), maxPages = MAX_PAGES } = {}) {
  if (typeof repository !== "string" || repository.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(repository)) throw new Error("A valid public owner/repository is required.");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGES) throw new Error("Invalid pagination bound.");
  const observedFrom = now().toISOString();
  const base = `/repos/${repository}`;
  const source = { repository: `${API}${base}`, pilotIssues: `${API}${base}/issues?state=all`, releases: `${API}${base}/releases` };
  const owner = repository.split("/")[0].toLowerCase();
  const metadata = await measure(source.repository, async () => {
    const repo = record(await read(base));
    if (repo.private !== false) throw new ReportError("PUBLIC_REPOSITORY_REQUIRED");
    return { value: { stars: count(repo.stargazers_count), forks: count(repo.forks_count) } };
  });
  let pilotIssues;
  let tarballDownloads;
  if (metadata.status !== "observed") {
    pilotIssues = unknown(source.pilotIssues, "PUBLIC_REPOSITORY_NOT_VERIFIED");
    tarballDownloads = unknown(source.releases, "PUBLIC_REPOSITORY_NOT_VERIFIED");
  } else {
    [pilotIssues, tarballDownloads] = await Promise.all([
      measure(source.pilotIssues, async () => {
        const issues = await pages(read, `${base}/issues?state=all`, maxPages);
        let publicIssues = 0;
        let pilotIssuesIncludingOwnerAndBots = 0;
        let excludedOwnerOrBot = 0;
        const urls = [];
        for (const issue of issues) {
          if (Object.hasOwn(issue, "pull_request")) continue;
          publicIssues += 1;
          if (typeof issue.title !== "string" || !Array.isArray(issue.labels)) invalid();
          const isPilot = /^\[pilot\]/iu.test(issue.title) || issue.labels.some(label =>
            (typeof label === "string" ? label : label?.name)?.toLowerCase() === "pilot");
          if (!isPilot) continue;
          pilotIssuesIncludingOwnerAndBots += 1;
          const author = record(issue.user);
          if (typeof author.login !== "string" || !["User", "Bot", "Organization"].includes(author.type)) throw new ReportError("UNKNOWN_ISSUE_AUTHOR");
          if (author.login.toLowerCase() === owner || issue.author_association === "OWNER" || author.type === "Bot" || /\[bot\]$/iu.test(author.login)) {
            excludedOwnerOrBot += 1;
            continue;
          }
          const number = count(issue.number);
          urls.push(`https://github.com/${repository}/issues/${number}`);
        }
        return { value: urls.length, publicIssuesScannedExcludingPRs: publicIssues, pilotIssuesIncludingOwnerAndBots, excludedOwnerOrBot,
          issueUrls: urls.slice(0, 25), issueUrlsTruncated: urls.length > 25 };
      }),
      measure(source.releases, async () => {
        const releases = await pages(read, `${base}/releases`, maxPages);
        let value = 0;
        let publicReleases = 0;
        let tarballAssets = 0;
        for (const release of releases) {
          if (typeof release.draft !== "boolean") invalid();
          if (release.draft) continue;
          publicReleases += 1;
          const assets = await pages(read, `${base}/releases/${release.id}/assets`, maxPages);
          for (const asset of assets) {
            if (typeof asset.name !== "string") invalid();
            if (!/\.(?:tgz|tar\.gz)$/iu.test(asset.name)) continue;
            value = count(value + count(asset.download_count));
            tarballAssets += 1;
          }
        }
        return { value, publicReleases, tarballAssets };
      }),
    ]);
  }
  let outcomes;
  try { outcomes = manualEvidence(manualRecords); }
  catch { outcomes = { status: "unknown", recordedEvidenceCount: null, byOutcome: null, reason: "Manual evidence register is unavailable or invalid.", evidence: [] }; }
  return { schemaVersion: 1, repository, observedFrom, observedTo: now().toISOString(),
    metrics: {
      stars: metadata.status === "observed" ? { status: "observed", value: metadata.value.stars, source: source.repository } : unknown(source.repository, metadata.reason),
      forks: metadata.status === "observed" ? { status: "observed", value: metadata.value.forks, source: source.repository } : unknown(source.repository, metadata.reason),
      externalPilotIssues: pilotIssues, releaseTarballDownloads: tarballDownloads,
    }, outcomes,
    limitations: [
      "Counts are cumulative public GitHub observations, not changes during the last seven days or a transactional snapshot.",
      "Stars and forks indicate public interest, not actual users, successful runs, or adoption.",
      "Pilot issue counts include incomplete attempts and repeated reports; they do not prove distinct people, successful use, willingness, or helpfulness.",
      "Release tarball downloads include maintainer, CI, and repeated downloads; they are not unique users, installations, successful execution, or npm downloads.",
      "Actual use, repeat use, and problem resolution cannot be inferred from these aggregates. Manual evidence counts are records, not population totals.",
      "No CLI telemetry is collected. Issue titles, bodies, usernames, and raw API responses are not included in this report.",
    ] };
}

export function renderAdoption(report) {
  const metric = value => value.status === "observed" ? String(value.value) : `unknown (${value.reason})`;
  const lines = ["# SkillWhy weekly public GitHub record", "", `Repository: [${report.repository}](https://github.com/${report.repository})`,
    `Observed: ${report.observedFrom} → ${report.observedTo} (UTC)`, "", "| Cumulative signal | Value |", "| --- | --- |",
    `| Stars | ${metric(report.metrics.stars)} |`, `| Forks | ${metric(report.metrics.forks)} |`,
    `| Public pilot issues, excluding PRs/owner/bots | ${metric(report.metrics.externalPilotIssues)} |`,
    `| Release tarball download requests | ${metric(report.metrics.releaseTarballDownloads)} |`, ""];
  const pilots = report.metrics.externalPilotIssues;
  if (pilots.status === "observed") lines.push(`Pilot denominator: ${pilots.pilotIssuesIncludingOwnerAndBots} matching issues among ${pilots.publicIssuesScannedExcludingPRs} public issues; ${pilots.excludedOwnerOrBot} owner/bot reports excluded. This is an issue count, not a user count.`, "");
  lines.push(`Manual evidence records: ${report.outcomes.recordedEvidenceCount ?? "unknown"}. ${report.outcomes.reason}`, "");
  if (report.outcomes.byOutcome) for (const [outcome, value] of Object.entries(report.outcomes.byOutcome)) lines.push(`- ${outcome}: ${value} reviewed records`);
  lines.push("", "Sources:");
  for (const source of new Set(Object.values(report.metrics).map(item => item.source))) lines.push(`- [GitHub API](${source})`);
  if (pilots.status === "observed" && pilots.issueUrls.length) {
    lines.push("", `Pilot issue links${pilots.issueUrlsTruncated ? " (first 25 only)" : ""}:`);
    for (const url of pilots.issueUrls) lines.push(`- [Public report](${url})`);
  }
  lines.push("", ...report.limitations.map(note => `- ${note}`), "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let manualRecords;
    try { manualRecords = JSON.parse(readFileSync(new URL("../docs/adoption-records.json", import.meta.url), "utf8")); }
    catch { manualRecords = null; }
    const report = await collectAdoption({ repository: process.env.GITHUB_REPOSITORY ?? "hyscodebase/skillwhy", read: githubReader({ token: process.env.GH_TOKEN }), manualRecords });
    const markdown = renderAdoption(report);
    if (process.env.ADOPTION_REPORT_DIR) {
      const directory = resolve(process.env.ADOPTION_REPORT_DIR);
      mkdirSync(directory, { mode: 0o700 });
      writeFileSync(join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      writeFileSync(join(directory, "report.md"), markdown, { flag: "wx", mode: 0o600 });
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    console.log(markdown);
  } catch (error) { console.error(error instanceof ReportError ? error.code : "Could not generate the public GitHub report."); process.exitCode = 1; }
}
