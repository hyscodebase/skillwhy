import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkRelease } from "./release-check.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function loadAssets(directory, release) {
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || ["name", "version", "tag", "commit"].some((key) => manifest[key] !== release[key]) ||
      !Array.isArray(manifest.files) || manifest.files.length !== 2 ||
      manifest.files[1]?.name !== "SHA256SUMS" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tgz$/.test(manifest.files[0]?.name)) {
    throw new Error("Release manifest does not match the validated tag.");
  }
  const assets = manifest.files.map((file) => {
    const bytes = readFileSync(join(directory, file.name));
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error("Release asset checksum mismatch.");
    return { ...file, bytes };
  });
  if (assets[1].bytes.toString("utf8") !== `${assets[0].sha256}  ${assets[0].name}\n`) {
    throw new Error("SHA256SUMS does not match the tarball.");
  }
  return { manifest, assets };
}

export function githubRequest(token, fetchImpl = fetch) {
  if (!token) throw new Error("GH_TOKEN is required for GitHub release publication.");
  return async function request(method, path, body, upload = false) {
    if (!path.startsWith("/repos/")) throw new Error("Unexpected GitHub API path.");
    const url = `https://${upload ? "uploads" : "api"}.github.com${path}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          method, redirect: "error", signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "skillwhy-release",
            ...(body === undefined ? {} : { "Content-Type": upload ? "application/octet-stream" : "application/json" }) },
          ...(body === undefined ? {} : { body: upload ? body : JSON.stringify(body) }),
        });
      } catch {
        // Writes are never blindly retried: rerun the workflow to reconcile the draft.
        if (method !== "GET" || attempt === 2) throw new Error(`GitHub ${method} request failed. Rerun to reconcile release state.`);
      }
      if (response?.ok) return response.json();
      if (response && !(method === "GET" && [429, 502, 503, 504].includes(response.status) && attempt < 2)) {
        throw new Error(`GitHub ${method} request failed with HTTP ${response.status}. Existing assets were not replaced.`);
      }
      await new Promise((done) => setTimeout(done, 250 * 2 ** attempt));
    }
    throw new Error("GitHub request retries exhausted.");
  };
}

export async function publishRelease({ manifest, assets, repository, request }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) throw new Error("Invalid GITHUB_REPOSITORY.");
  const base = `/repos/${repository}`;
  const taggedSource = `https://github.com/${repository}/blob/${encodeURIComponent(manifest.tag)}`;
  const marker = `<!-- skillwhy-release:v1 ${manifest.commit} ${assets.map((asset) => asset.sha256).join(" ")} -->`;
  const body = `${marker}\n\nSkillWhy ${manifest.version} prerelease.\n\n` +
    "Built from the tagged commit after the Linux/macOS × Node 22/24 test matrix. " +
    "The packaged CLI was installed in an isolated prefix and checked with --version and the synthetic demo.\n\n" +
    "Assets: npm tarball and SHA256SUMS. This release is not published to the npm registry. " +
    `See [installation and checksum verification](${taggedSource}/docs/releasing.md).\n\n` +
    `[Changelog](${taggedSource}/CHANGELOG.md) · [README](${taggedSource}/README.md)\n\n` +
    "These checks do not establish native Codex compatibility on additional operating systems.\n";

  const verifyRemoteTag = async () => {
    const reference = await request("GET", `${base}/git/ref/tags/${encodeURIComponent(manifest.tag)}`);
    let object = reference.object;
    for (let depth = 0; object?.type === "tag" && depth < 8; depth++) {
      if (!/^[a-f0-9]{40}$/.test(object.sha)) throw new Error("Invalid remote tag object.");
      object = (await request("GET", `${base}/git/tags/${object.sha}`)).object;
    }
    if (object?.type !== "commit" || object.sha !== manifest.commit) throw new Error("The remote tag target changed; publication stopped.");
    const comparison = await request("GET", `${base}/compare/${manifest.commit}...main`);
    if (!["ahead", "identical"].includes(comparison.status) || comparison.merge_base_commit?.sha !== manifest.commit) {
      throw new Error("The release commit is no longer reachable from main.");
    }
  };
  const list = async (path) => {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const items = await request("GET", `${path}?per_page=100&page=${page}`);
      if (!Array.isArray(items)) throw new Error("Unexpected GitHub list response.");
      all.push(...items);
      if (items.length < 100) return all;
    }
    throw new Error("GitHub pagination limit reached; refusing an incomplete state check.");
  };
  const checkAsset = (actual, expected) => {
    if (actual.state !== "uploaded" || actual.size !== expected.size || actual.digest !== `sha256:${expected.sha256}`) {
      throw new Error("An existing release asset is incomplete or has a different checksum. No asset was replaced.");
    }
  };

  await verifyRemoteTag();
  // The list endpoint includes drafts for this contents:write token, unlike public tag lookups.
  const existing = (await list(`${base}/releases`)).filter((release) => release.tag_name === manifest.tag);
  if (existing.length > 1) throw new Error("Multiple releases use this tag; manual inspection is required.");
  let release = existing[0];
  if (release && (release.body !== body || release.prerelease !== true)) {
    throw new Error("A release already uses this tag and is not the identical automation release. It was not changed.");
  }
  if (!release) release = await request("POST", `${base}/releases`, {
    tag_name: manifest.tag, target_commitish: manifest.commit, name: manifest.tag,
    body, draft: true, prerelease: true, make_latest: "false",
  });
  if (!Number.isSafeInteger(release.id) || release.id <= 0 || typeof release.draft !== "boolean") {
    throw new Error("Unexpected GitHub release response.");
  }
  const assetPath = `${base}/releases/${release.id}/assets`;
  const remoteAssets = await list(assetPath);
  if (remoteAssets.some((asset) => !assets.some((expected) => expected.name === asset.name)) ||
      new Set(remoteAssets.map((asset) => asset.name)).size !== remoteAssets.length) {
    throw new Error("Unexpected assets already exist on the release. No asset was replaced.");
  }
  for (const asset of assets) {
    const existingAsset = remoteAssets.find((item) => item.name === asset.name);
    if (existingAsset) checkAsset(existingAsset, asset);
    else {
      if (!release.draft) throw new Error("Published release is missing an asset. Published releases are never modified.");
      const uploaded = await request("POST", `${assetPath}?name=${encodeURIComponent(asset.name)}`, asset.bytes, true);
      checkAsset(uploaded, asset);
    }
  }
  // Read back the complete remote asset set before exposing the release.
  const verified = await list(assetPath);
  if (verified.length !== assets.length) throw new Error("Remote release asset count changed.");
  for (const asset of assets) {
    const found = verified.find((item) => item.name === asset.name);
    if (!found) throw new Error("Remote release asset is missing.");
    checkAsset(found, asset);
  }
  await verifyRemoteTag();
  if (!release.draft) return { status: "already-published", tag: manifest.tag };
  const published = await request("PATCH", `${base}/releases/${release.id}`, { draft: false, prerelease: true, make_latest: "false" });
  if (published.draft !== false || published.prerelease !== true || published.tag_name !== manifest.tag) {
    throw new Error("GitHub did not confirm prerelease publication. Rerun to inspect the resulting state.");
  }
  return { status: "published", tag: manifest.tag };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const release = checkRelease();
    if (!process.env.RELEASE_DIR) throw new Error("RELEASE_DIR is required.");
    const built = loadAssets(process.env.RELEASE_DIR, release);
    console.log(JSON.stringify(await publishRelease({ ...built, repository: process.env.GITHUB_REPOSITORY,
      request: githubRequest(process.env.GH_TOKEN) })));
  } catch (error) { console.error(error instanceof Error ? error.message : "Release publication failed."); process.exitCode = 1; }
}
