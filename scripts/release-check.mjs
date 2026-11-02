import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const core = "(?:0|[1-9][0-9]*)";
const identifier = "(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)";
const prereleaseVersion = new RegExp(`^${core}\\.${core}\\.${core}-${identifier}(?:\\.${identifier})*$`);

export function checkPackage(cwd = process.cwd()) {
  const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(cwd, "package-lock.json"), "utf8"));
  if (pkg.name !== "@hyscodebase/skillwhy" || !prereleaseVersion.test(pkg.version)) {
    throw new Error("Only SkillWhy prerelease versions without build metadata are supported.");
  }
  if (lock.name !== pkg.name || lock.version !== pkg.version ||
      lock.packages?.[""]?.name !== pkg.name || lock.packages?.[""]?.version !== pkg.version) {
    throw new Error("package.json and package-lock.json must have matching names and versions.");
  }
  return { name: pkg.name, version: pkg.version, tag: `v${pkg.version}` };
}

export function checkRelease({ cwd = process.cwd(), tag = process.env.RELEASE_TAG,
  expectedSha = process.env.GITHUB_SHA } = {}) {
  const metadata = checkPackage(cwd);
  if (tag !== metadata.tag) throw new Error("The tag must exactly match v + package.json version.");
  const git = (...args) => execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
  }).trim();
  const commit = git("rev-parse", "HEAD^{commit}");
  if (!/^[a-f0-9]{40}$/.test(commit) || git("rev-parse", `refs/tags/${tag}^{commit}`) !== commit) {
    throw new Error("The checked out commit must be the exact tag target.");
  }
  if (expectedSha !== undefined && (!/^[a-f0-9]{40}$/.test(expectedSha) ||
      git("rev-parse", `${expectedSha}^{commit}`) !== commit)) {
    throw new Error("The event commit does not match the checked out tag.");
  }
  try { git("merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"); }
  catch { throw new Error("Release tags must point to a commit already reachable from origin/main."); }
  return { ...metadata, commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(checkRelease())); }
  catch (error) { console.error(error instanceof Error ? error.message : "Release validation failed."); process.exitCode = 1; }
}
