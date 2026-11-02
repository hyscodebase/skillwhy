import test from "node:test";
import assert from "node:assert/strict";
import { collectAdoption, githubReader, manualEvidence, renderAdoption } from "../scripts/adoption-report.mjs";

const repository = "example/skillwhy";
const base = `/repos/${repository}`;
const now = () => new Date("2026-11-02T13:00:00.000Z");
const issue = (id, login, extra = {}) => ({ id, number: id, title: "[Pilot] PRIVATE_TITLE_CANARY", body: "PRIVATE_BODY_CANARY", labels: [], user: { login, type: "User" }, author_association: "NONE", ...extra });

function reader(overrides = {}) {
  const responses = {
    [base]: { private: false, stargazers_count: 7, forks_count: 2 },
    [`${base}/issues?state=all&per_page=100&page=1`]: [
      issue(1, "EXAMPLE"),
      issue(2, "maintenance[bot]", { user: { login: "maintenance[bot]", type: "Bot" } }),
      issue(3, "external-user-one"),
      issue(4, "external-user-two", { title: "other private title", labels: [{ name: "Pilot" }] }),
      issue(5, "external-user-three", { pull_request: { url: "not-an-issue" } }),
      issue(6, "external-user-four", { title: "ordinary issue" }),
      issue(7, "owner-other-login", { author_association: "OWNER" }),
    ],
    [`${base}/releases?per_page=100&page=1`]: [{ id: 11, draft: false }, { id: 12, draft: false }, { id: 13, draft: true }],
    [`${base}/releases/11/assets?per_page=100&page=1`]: [{ id: 21, name: "skillwhy.tgz", download_count: 3 }, { id: 22, name: "SHA256SUMS", download_count: 77 }],
    [`${base}/releases/12/assets?per_page=100&page=1`]: [{ id: 31, name: "skillwhy.tar.gz", download_count: 5 }, { id: 32, name: "other.zip", download_count: 100 }],
    ...overrides,
  };
  return async path => {
    assert.ok(Object.hasOwn(responses, path), `Unexpected API read: ${path}`);
    const result = responses[path];
    if (result instanceof Error) throw result;
    return structuredClone(result);
  };
}

test("pilot counts exclude PRs, repository owner, OWNER association and bots with explicit denominators", async () => {
  const report = await collectAdoption({ repository, read: reader(), now });
  assert.equal(report.metrics.stars.value, 7);
  assert.equal(report.metrics.forks.value, 2);
  assert.deepEqual(report.metrics.externalPilotIssues, {
    status: "observed", source: `https://api.github.com${base}/issues?state=all`, value: 2,
    publicIssuesScannedExcludingPRs: 6, pilotIssuesIncludingOwnerAndBots: 5, excludedOwnerOrBot: 3,
    issueUrls: [`https://github.com/${repository}/issues/3`, `https://github.com/${repository}/issues/4`], issueUrlsTruncated: false,
  });
  const output = JSON.stringify(report) + renderAdoption(report);
  for (const privateValue of ["PRIVATE_TITLE_CANARY", "PRIVATE_BODY_CANARY", "external-user-one", "external-user-two", "maintenance[bot]"]) assert.ok(!output.includes(privateValue));
  assert.match(renderAdoption(report), /5 matching issues among 6 public issues; 3 owner\/bot reports excluded/u);
});

test("download requests sum tarball assets only and never become a user or success metric", async () => {
  const report = await collectAdoption({ repository, read: reader(), now });
  assert.equal(report.metrics.releaseTarballDownloads.value, 8);
  assert.equal(report.metrics.releaseTarballDownloads.publicReleases, 2);
  assert.equal(report.metrics.releaseTarballDownloads.tarballAssets, 2);
  assert.equal(report.outcomes.status, "unknown");
  assert.equal(report.outcomes.recordedEvidenceCount, 0);
  assert.equal(report.outcomes.byOutcome, null);
  assert.ok(report.limitations.some(note => note.includes("maintainer, CI, and repeated downloads")));
  assert.ok(report.limitations.some(note => note.includes("not unique users")));
});

test("pagination includes later pilot reports without turning the page bound into a partial count", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => issue(index + 100, "external", { title: "ordinary issue" }));
  const read = reader({
    [`${base}/issues?state=all&per_page=100&page=1`]: firstPage,
    [`${base}/issues?state=all&per_page=100&page=2`]: [issue(200, "another-external")],
  });
  const complete = await collectAdoption({ repository, read, now });
  assert.equal(complete.metrics.externalPilotIssues.value, 1);
  assert.equal(complete.metrics.externalPilotIssues.publicIssuesScannedExcludingPRs, 101);
  const limited = await collectAdoption({ repository, read, now, maxPages: 1 });
  assert.equal(limited.metrics.externalPilotIssues.status, "unknown");
  assert.equal(limited.metrics.externalPilotIssues.value, null);
  assert.equal(limited.metrics.externalPilotIssues.reason, "PAGINATION_LIMIT");
});

test("a failed issue fetch stays unknown while independent sources remain usable", async () => {
  const report = await collectAdoption({ repository, read: reader({ [`${base}/issues?state=all&per_page=100&page=1`]: new Error("PRIVATE_ERROR_CANARY") }), now });
  assert.equal(report.metrics.externalPilotIssues.status, "unknown");
  assert.equal(report.metrics.externalPilotIssues.value, null);
  assert.equal(report.metrics.stars.value, 7);
  assert.equal(report.metrics.releaseTarballDownloads.value, 8);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_ERROR_CANARY"));
});

test("failed or private repository metadata prevents other reads and never fabricates zeros", async () => {
  for (const result of [new Error("unavailable"), { private: true, stargazers_count: 1, forks_count: 1 }]) {
    const calls = [];
    const report = await collectAdoption({ repository, now, read: async path => {
      calls.push(path);
      if (result instanceof Error) throw result;
      return result;
    } });
    assert.deepEqual(calls, [base]);
    for (const metric of Object.values(report.metrics)) {
      assert.equal(metric.status, "unknown");
      assert.equal(metric.value, null);
    }
  }
});

test("observed empty sources produce real zeros, separately from unknown actual outcomes", async () => {
  const report = await collectAdoption({ repository, now, read: reader({
    [base]: { private: false, stargazers_count: 0, forks_count: 0 },
    [`${base}/issues?state=all&per_page=100&page=1`]: [],
    [`${base}/releases?per_page=100&page=1`]: [],
  }) });
  for (const metric of Object.values(report.metrics)) {
    assert.equal(metric.status, "observed");
    assert.equal(metric.value, 0);
  }
  assert.equal(report.outcomes.status, "unknown");
});

test("malformed download data and unclassifiable pilot authors produce unknown totals", async () => {
  const report = await collectAdoption({ repository, now, read: reader({
    [`${base}/issues?state=all&per_page=100&page=1`]: [issue(1, "external", { user: null })],
    [`${base}/releases/12/assets?per_page=100&page=1`]: [{ id: 31, name: "skillwhy.tgz", download_count: -1 }],
  }) });
  assert.equal(report.metrics.externalPilotIssues.status, "unknown");
  assert.equal(report.metrics.releaseTarballDownloads.status, "unknown");
  assert.equal(report.metrics.releaseTarballDownloads.value, null);
});

test("manual evidence is explicit, bounded, deduplicated and never counted as unique users", async () => {
  const item = { date: "2026-11-02", evidenceUrl: "https://github.com/example/skillwhy/issues/3#issuecomment-1", outcome: "first-live-use",
    externalParticipantConfirmed: true, maintainerConfirmed: true, publicSummaryApproved: true };
  const manualRecords = { schemaVersion: 1, records: [item, { ...item, outcome: "repeat-use" }] };
  const report = await collectAdoption({ repository, read: reader(), manualRecords, now });
  assert.equal(report.outcomes.status, "manual-evidence");
  assert.equal(report.outcomes.recordedEvidenceCount, 2);
  assert.equal(report.outcomes.byOutcome["first-live-use"], 1);
  assert.equal(report.outcomes.byOutcome["repeat-use"], 1);
  assert.equal(report.outcomes.byOutcome["problem-helped"], 0);
  assert.match(report.outcomes.reason, /not unique users/u);
  assert.throws(() => manualEvidence({ schemaVersion: 1, records: [item, item] }), /DUPLICATE_MANUAL_EVIDENCE/u);
  for (const invalid of [{ ...item, maintainerConfirmed: false }, { ...item, publicSummaryApproved: false }, { ...item, date: "2026-02-30" }, { ...item, privateNote: "SECRET" }, { ...item, evidenceUrl: "http://private.example" }]) {
    assert.throws(() => manualEvidence({ schemaVersion: 1, records: [invalid] }));
  }
  const invalidRegister = await collectAdoption({ repository, read: reader(), manualRecords: { schemaVersion: 1, records: [{ ...item, privateNote: "SECRET" }] }, now });
  assert.equal(invalidRegister.outcomes.status, "unknown");
  assert.equal(invalidRegister.outcomes.recordedEvidenceCount, null);
  assert.ok(!JSON.stringify(invalidRegister).includes("SECRET"));
});

test("GitHub reader uses bounded read-only requests without following token redirects", async () => {
  let seen;
  const read = githubReader({ token: "SECRET_TOKEN", maxRequests: 1, fetchImpl: async (url, options) => {
    seen = { url, options };
    return new Response(JSON.stringify({ ok: true }));
  } });
  assert.deepEqual(await read(base), { ok: true });
  assert.equal(seen.url, `https://api.github.com${base}`);
  assert.equal(seen.options.method, "GET");
  assert.equal(seen.options.redirect, "error");
  assert.ok(seen.options.signal instanceof AbortSignal);
  assert.equal(seen.options.headers.Authorization, "Bearer SECRET_TOKEN");
  await assert.rejects(read(base), /REQUEST_LIMIT/u);
  const failed = githubReader({ fetchImpl: async () => new Response("PRIVATE_BODY", { status: 403 }) });
  await assert.rejects(failed(base), error => error.message === "HTTP_403");
});
