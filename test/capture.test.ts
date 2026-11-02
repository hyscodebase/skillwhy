import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureSnapshot, parseSkillsList, readSkillDigest } from "../src/capture.js";
import { parseSnapshot } from "../src/validate.js";
import { isSupportedNativeHost, supportedNativeHostLabel } from "../src/compatibility.js";

async function tempRoot(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "skillwhy-capture-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const skill = (path = "/test/.agents/skills/deploy/SKILL.md") => ({
  name: "deploy", path, description: "PRIVATE_DESCRIPTION", enabled: true, scope: "repo",
  interface: { defaultPrompt: "PRIVATE_PROMPT" }, dependencies: { tools: [{ value: "PRIVATE_TOKEN" }] },
});
const payload = (skills: unknown[], errors: unknown[] = []) => ({ data: [{ cwd: "/test", skills, errors }] });

test("production native support remains restricted to reviewed combinations", () => {
  assert.equal(isSupportedNativeHost("0.166.0", "darwin", "arm64"), true);
  assert.equal(isSupportedNativeHost("0.166.0", "linux", "x64"), true);
  assert.equal(isSupportedNativeHost("0.166.0", "linux", "arm64"), false);
  assert.equal(isSupportedNativeHost("0.166.0", "darwin", "x64"), false);
  assert.equal(isSupportedNativeHost("0.166.0", "win32", "x64"), false);
  assert.equal(isSupportedNativeHost("0.167.0", "darwin", "arm64"), false);
  assert.equal(supportedNativeHostLabel(), "Codex CLI 0.166.0 on macOS arm64; Codex CLI 0.166.0 on Linux x64");
});

test("normalization preserves duplicate names and omits content/dependency fields", () => {
  const result = parseSkillsList(payload([skill(), { ...skill("/elsewhere/SKILL.md"), enabled: false, scope: "user" }]), "/test");
  assert.equal(result.skills.length, 2);
  assert.deepEqual(result.skills.map((entry) => entry.name), ["deploy", "deploy"]);
  assert.deepEqual(result.errors, []);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  assert.equal(result.skills.filter((entry) => !entry.enabled).length, 1);
});

test("incomplete metadata remains unknown rather than enabled", () => {
  const input = { name: "deploy", path: "/test/SKILL.md", description: "ok" };
  const result = parseSkillsList(payload([input]), "/test");
  assert.equal(result.skills[0]?.enabled, null);
  assert.equal(result.skills[0]?.scope, null);
  assert.equal(result.errors[0]?.code, "SKILL_METADATA_INCOMPLETE");
});

test("native errors do not leak native paths or messages", () => {
  const result = parseSkillsList(payload([], [{ message: "PRIVATE_MESSAGE", path: "/PRIVATE_PATH" }]), "/test");
  assert.deepEqual(result.errors, [{ code: "NATIVE_SKILL_ERRORS", scope: "inventory" }]);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});

test("a mismatched cwd cannot be accepted as the requested inventory", () => {
  assert.throws(() => parseSkillsList(payload([]), "/another-project"), /SKILLS_CWD_RESPONSE_MISMATCH/);
  assert.throws(() => parseSkillsList({ data: [] }, "/test"), /SKILLS_CWD_RESPONSE_MISMATCH/);
});

test("invalid metadata is skipped with a partial error; empty valid lists stay valid", () => {
  assert.deepEqual(parseSkillsList(payload([]), "/test"), { skills: [], errors: [] });
  const result = parseSkillsList(payload([{ ...skill(), name: "bad\u001b[31m" }, { path: "/test/SKILL.md" }]), "/test");
  assert.equal(result.skills.length, 0);
  assert.equal(result.errors[0]?.code, "SKILL_METADATA_INVALID");
});

test("native metadata respects snapshot string and root-count limits", () => {
  const result = parseSkillsList(payload([
    { ...skill(), name: "n".repeat(256) },
    { ...skill(), name: "n".repeat(257) },
    skill("/outside/" + "x".repeat(4087)),
    skill("/outside/" + "x".repeat(4088)),
    // This raw path fits, but adding the project alias would exceed the limit.
    skill("/test/" + "x".repeat(4090)),
  ]), "/test");
  assert.equal(result.skills.length, 2);
  assert.equal(result.errors[0]?.code, "SKILL_METADATA_INVALID");
  const many = parseSkillsList(payload(Array.from({ length: 10_000 }, (_, index) => skill(`/external-${index}/SKILL.md`))), "/test");
  assert.equal(many.skills.length, 9_999);
  assert.deepEqual(many.errors, [{ code: "SKILL_COUNT_LIMIT", scope: "inventory" }]);
});

test("digest hashes only one selected regular SKILL.md file", async (t) => {
  const root = await tempRoot(t);
  const path = join(root, "SKILL.md");
  const bytes = Buffer.from("---\nname: example\n---\nhello\r\n");
  await writeFile(path, bytes);
  await writeFile(join(root, "reference.txt"), "NOT_PART_OF_DIGEST");
  const result = await readSkillDigest(root, path);
  assert.equal(result.status, "collected");
  assert.equal(result.digest, createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(result.coverage, ["SKILL.md"]);
});

test("outside and nonlocal paths are not read", async (t) => {
  const root = await tempRoot(t);
  assert.equal((await readSkillDigest(root, "/outside/SKILL.md")).status, "outside-scope");
  assert.equal((await readSkillDigest(root, "remote://skill/SKILL.md")).status, "nonlocal");
  assert.equal((await readSkillDigest(root, join(root, "not-SKILL.txt"))).status, "unreadable");
});

test("symlink files and symlink parents are refused without following them", async (t) => {
  const root = await tempRoot(t);
  const other = await tempRoot(t);
  await writeFile(join(other, "SKILL.md"), "PRIVATE_OTHER_ROOT");
  await symlink(join(other, "SKILL.md"), join(root, "SKILL.md"));
  assert.equal((await readSkillDigest(root, join(root, "SKILL.md"))).digest, null);
  await symlink(other, join(root, "linked"), "dir");
  assert.equal((await readSkillDigest(root, join(root, "linked", "SKILL.md"))).digest, null);
});

test("broken links, directory targets and oversized files do not yield digests", async (t) => {
  const root = await tempRoot(t);
  await mkdir(join(root, "directory", "SKILL.md"), { recursive: true });
  await mkdir(join(root, "large"));
  await writeFile(join(root, "large", "SKILL.md"), Buffer.alloc(2 * 1024 * 1024 + 1));
  await symlink(join(root, "missing"), join(root, "SKILL.md"));
  for (const path of [join(root, "SKILL.md"), join(root, "directory", "SKILL.md"), join(root, "large", "SKILL.md")]) {
    const result = await readSkillDigest(root, path);
    assert.equal(result.status, "unreadable");
    assert.equal(result.digest, null);
  }
});

test("missing executable returns a structured error without raw paths", async (t) => {
  const root = await tempRoot(t);
  const result = await captureSnapshot({ cwd: root, codexBin: join(root, "PRIVATE_MISSING_BINARY") });
  assert.equal(result.capture.status, "error");
  assert.equal(result.errors[0]?.code, "HOST_NOT_FOUND");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_MISSING_BINARY"));
});

test("unsupported version never starts app-server", async (t) => {
  const root = await tempRoot(t);
  const executable = join(root, "fake-codex.mjs");
  await writeFile(executable, `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nif (process.argv[2] === '--version') console.log('codex-cli 9.9.9'); else writeFileSync('UNEXPECTED_START', 'bad');\n`);
  await chmod(executable, 0o700);
  const result = await captureSnapshot({ cwd: root, codexBin: executable });
  assert.equal(result.capture.status, "unsupported");
  assert.equal(result.capture.hostVersion, "9.9.9");
  await assert.rejects(readFile(join(root, "UNEXPECTED_START")));
});

test("capture normalizes a fake native session and keeps optional digests scoped", { skip: !isSupportedNativeHost("0.166.0") }, async (t) => {
  const root = await tempRoot(t);
  const skillPath = join(root, ".agents", "skills", "deploy", "SKILL.md");
  await mkdir(join(root, ".agents", "skills", "deploy"), { recursive: true });
  await writeFile(skillPath, "hello\n");
  const executable = join(root, "fake-codex.mjs");
  await writeFile(executable, `#!/usr/bin/env node
    import readline from 'node:readline';
    if (process.argv[2] === '--version') { console.log('codex-cli 0.166.0'); process.exit(0); }
    const send = (value) => process.stdout.write(JSON.stringify(value) + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (line) => {
      const m = JSON.parse(line);
      if (m.method === 'initialize') send({ id: m.id, result: {} });
      if (m.method === 'skills/list') send({ id: m.id, result: { data: [{ cwd: process.cwd(), errors: [], skills: [
        { name: 'deploy', path: ${JSON.stringify(skillPath)}, description: 'PRIVATE_DESCRIPTION', enabled: true, scope: 'repo' },
        { name: 'deploy', path: '/outside/SKILL.md', description: 'PRIVATE_DESCRIPTION', enabled: false, scope: 'user' }
      ] }] } });
    });
  `);
  await chmod(executable, 0o700);
  const snapshot = await captureSnapshot({ cwd: root, codexBin: executable, digest: true });
  assert.equal(parseSnapshot(snapshot), snapshot);
  assert.equal(snapshot.capture.status, "complete");
  assert.equal(snapshot.coverage.roots, "unknown");
  assert.equal(snapshot.entries.length, 2);
  assert.ok(!JSON.stringify(snapshot).includes("PRIVATE_DESCRIPTION"));
  assert.equal(snapshot.entries.find((entry) => entry.sourcePath === skillPath)?.locationAlias, "project/.agents/skills/deploy/SKILL.md");
  assert.equal(snapshot.entries.find((entry) => entry.sourcePath === skillPath)?.content.status, "collected");
  assert.equal(snapshot.entries.find((entry) => entry.sourcePath === "/outside/SKILL.md")?.content.status, "outside-scope");
  assert.equal(snapshot.findings[0]?.code, "DUPLICATE_NAME_RETURNED");
});
