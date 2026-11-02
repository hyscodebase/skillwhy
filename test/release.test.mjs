import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkPackage, checkRelease } from "../scripts/release-check.mjs";
import { githubRequest, loadAssets, publishRelease } from "../scripts/release-publish.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const version = "0.1.0-alpha.2";
const commit = "a".repeat(40);
const manifest = { schemaVersion: 1, name: "@hyscodebase/skillwhy", version, tag: `v${version}`, commit };
const archive = Buffer.from("synthetic tarball for release state tests");
const files = [
  { name: "hyscodebase-skillwhy-0.1.0-alpha.2.tgz", bytes: archive },
  { name: "SHA256SUMS", bytes: Buffer.from(`${hash(archive)}  hyscodebase-skillwhy-0.1.0-alpha.2.tgz\n`) },
];
const assets = files.map((file) => ({ ...file, sha256: hash(file.bytes), size: file.bytes.length }));

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "skillwhy-release-test-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release-test@example.invalid");
  const pkg = { name: manifest.name, version };
  writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(cwd, "package-lock.json"), JSON.stringify({ ...pkg, packages: { "": pkg } }));
  git("add", "."); git("commit", "-m", "fixture");
  const sha = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", sha);
  git("tag", "-a", manifest.tag, "-m", "annotated prerelease");
  return { cwd, git, sha };
}

function fakeGitHub() {
  const state = { releases: [], assets: [], requests: [], remoteCommit: commit, ancestor: true };
  const request = async (method, path, body, upload = false) => {
    state.requests.push({ method, path, body, upload });
    if (method === "GET" && path.includes("/git/ref/tags/")) return { object: { type: "commit", sha: state.remoteCommit } };
    if (method === "GET" && path.includes("/compare/")) return {
      status: state.ancestor ? "ahead" : "diverged", merge_base_commit: { sha: state.ancestor ? commit : "b".repeat(40) },
    };
    if (method === "GET" && path.includes("/assets?")) return structuredClone(state.assets);
    if (method === "GET" && path.includes("/releases?")) return structuredClone(state.releases);
    if (method === "POST" && path.endsWith("/releases")) {
      const release = { id: 7, ...body };
      state.releases.push(release); return structuredClone(release);
    }
    if (method === "POST" && upload) {
      const name = new URL(`https://uploads.github.com${path}`).searchParams.get("name");
      const asset = { name, size: body.length, state: "uploaded", digest: `sha256:${hash(body)}` };
      state.assets.push(asset); return structuredClone(asset);
    }
    if (method === "PATCH") { Object.assign(state.releases[0], body); return structuredClone(state.releases[0]); }
    throw new Error(`Unexpected fake request: ${method} ${path}`);
  };
  return { state, request, publish: (override = request) => publishRelease({ manifest, assets, repository: "owner/repo", request: override }) };
}

test("release gate accepts an annotated prerelease tag already on main", (t) => {
  const { cwd, sha } = repository(t);
  assert.equal(checkRelease({ cwd, tag: manifest.tag, expectedSha: sha }).commit, sha);
});

test("release gate rejects mismatched tag, event commit, and unmerged commit", (t) => {
  const { cwd, git, sha } = repository(t);
  assert.throws(() => checkRelease({ cwd, tag: "v0.1.0-alpha.3", expectedSha: sha }), /exactly match/);
  assert.throws(() => checkRelease({ cwd, tag: manifest.tag, expectedSha: "bad" }), /event commit/);
  writeFileSync(join(cwd, "new.txt"), "unmerged fixture");
  git("add", "."); git("commit", "-m", "unmerged"); git("tag", "-f", manifest.tag);
  assert.throws(() => checkRelease({ cwd, tag: manifest.tag, expectedSha: git("rev-parse", "HEAD") }), /reachable from origin\/main/);
  git("checkout", "--detach", sha);
  assert.throws(() => checkRelease({ cwd, tag: manifest.tag, expectedSha: sha }), /exact tag target/);
});

test("release gate refuses stable versions, malformed prerelease numbers, and lock drift", (t) => {
  const { cwd } = repository(t);
  for (const value of ["0.1.0", "0.1.0-alpha.01", "0.1.0-alpha.2+build", "00.1.0-alpha"]) {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: manifest.name, version: value }));
    assert.throws(() => checkPackage(cwd), /Only SkillWhy prerelease/);
  }
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: manifest.name, version: "0.1.0-alpha.3" }));
  assert.throws(() => checkPackage(cwd), /matching names and versions/);
});

test("publisher stages and verifies both assets before publishing a non-latest prerelease", async () => {
  const { state, publish } = fakeGitHub();
  assert.equal((await publish()).status, "published");
  const writes = state.requests.filter((item) => item.method !== "GET");
  assert.deepEqual(writes.map((item) => item.method), ["POST", "POST", "POST", "PATCH"]);
  assert.equal(writes[0].body.draft, true);
  assert.deepEqual(writes.at(-1).body, { draft: false, prerelease: true, make_latest: "false" });
  assert.equal(state.assets.length, 2);
});

test("rerunning an identical published release is a read-only success", async () => {
  const { state, publish } = fakeGitHub();
  await publish(); state.requests.length = 0;
  assert.equal((await publish()).status, "already-published");
  assert.ok(state.requests.every((item) => item.method === "GET"));
});

test("a rerun resumes an owned draft after one asset uploaded", async () => {
  const { state, publish, request } = fakeGitHub();
  await assert.rejects(publish(async (...args) => {
    if (args[0] === "POST" && args[3] && state.assets.length === 1) throw new Error("simulated connection failure");
    return request(...args);
  }), /simulated connection/);
  assert.equal(state.releases[0].draft, true);
  assert.equal(state.assets.length, 1);
  state.requests.length = 0;
  assert.equal((await publish()).status, "published");
  assert.equal(state.requests.filter((item) => item.upload).length, 1);
});

test("publisher never overwrites a conflicting asset or fills a published release", async () => {
  const { state, publish } = fakeGitHub();
  await publish(); state.requests.length = 0;
  state.assets[0].digest = `sha256:${"0".repeat(64)}`;
  await assert.rejects(publish(), /different checksum/);
  assert.ok(state.requests.every((item) => item.method === "GET"));
  state.assets = []; state.requests.length = 0;
  await assert.rejects(publish(), /Published releases are never modified/);
  assert.ok(state.requests.every((item) => item.method === "GET"));
});

test("publisher rejects an unrelated release with the same tag", async () => {
  const { state, publish } = fakeGitHub();
  state.releases.push({ id: 1, tag_name: manifest.tag, body: "manual release", draft: true, prerelease: true });
  await assert.rejects(publish(), /not the identical automation release/);
  assert.ok(state.requests.every((item) => item.method === "GET"));
});

test("publication refuses a moved tag or a commit removed from main", async () => {
  const { state, publish } = fakeGitHub();
  state.remoteCommit = "b".repeat(40);
  await assert.rejects(publish(), /remote tag target changed/);
  state.remoteCommit = commit; state.ancestor = false;
  await assert.rejects(publish(), /no longer reachable from main/);
  assert.ok(state.requests.every((item) => item.method === "GET"));
});

test("an advanced main is accepted, but behind or diverged main is rejected", async () => {
  for (const status of ["ahead", "identical", "behind", "diverged"]) {
    const { state, publish, request } = fakeGitHub();
    const operation = publish(async (...args) => {
      if (args[1].includes("/compare/")) return { status, merge_base_commit: { sha: commit } };
      return request(...args);
    });
    if (["ahead", "identical"].includes(status)) assert.equal((await operation).status, "published");
    else {
      await assert.rejects(operation, /no longer reachable from main/);
      assert.ok(state.requests.every((item) => item.method === "GET"));
    }
  }
});

test("tag is checked again after uploads, leaving a draft if the target changed", async () => {
  const { state, publish, request } = fakeGitHub();
  await assert.rejects(publish(async (...args) => {
    const result = await request(...args);
    if (state.assets.length === 2) state.remoteCommit = "b".repeat(40);
    return result;
  }), /remote tag target changed/);
  assert.equal(state.releases[0].draft, true);
  assert.ok(!state.requests.some((item) => item.method === "PATCH"));
});

test("publisher peels annotated remote tags", async () => {
  const { publish, request } = fakeGitHub();
  assert.equal((await publish(async (...args) => {
    if (args[1].includes("/git/ref/tags/")) return { object: { type: "tag", sha: "c".repeat(40) } };
    if (args[1].includes("/git/tags/")) return { object: { type: "commit", sha: commit } };
    return request(...args);
  })).status, "published");
});

test("an uncertain write is not retried and error output excludes token and server body", async () => {
  let calls = 0;
  const request = githubRequest("CANARY_TOKEN", async () => { calls++; throw new Error("CANARY_TOKEN raw response"); });
  await assert.rejects(request("POST", "/repos/owner/repo/releases", {}), (error) => {
    assert.ok(!error.message.includes("CANARY_TOKEN")); return /Rerun/.test(error.message);
  });
  assert.equal(calls, 1);
});

test("the publishing input rejects changed local tarball bytes", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "skillwhy-assets-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ ...manifest, files: assets.map(({ bytes, ...file }) => file) }));
  for (const file of assets) writeFileSync(join(dir, file.name), file.bytes);
  assert.equal(loadAssets(dir, manifest).assets.length, 2);
  writeFileSync(join(dir, assets[0].name), Buffer.concat([readFileSync(join(dir, assets[0].name)), Buffer.from("changed")]));
  assert.throws(() => loadAssets(dir, manifest), /checksum mismatch/);
});
