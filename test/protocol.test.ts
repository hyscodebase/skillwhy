import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaptureFailure, probeVersion, querySkills } from "../src/protocol.js";

async function fakeHost(t: TestContext, body: string): Promise<{ executable: string; cwd: string; timeoutMs: number }> {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), "skillwhy-protocol-")));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const executable = join(cwd, "fake-codex.mjs");
  await writeFile(executable, "#!/usr/bin/env node\n" + body);
  await chmod(executable, 0o700);
  return { executable, cwd, timeoutMs: 2000 };
}

const failureCode = (expected: string) => (error: unknown): boolean => error instanceof CaptureFailure && error.code === expected && error.message === expected;

const inheritedPipeHelper = `
  import { spawn } from 'node:child_process';
  import { writeFileSync } from 'node:fs';
  const helper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
    stdio: ['ignore', process.stdout, process.stderr],
  });
  writeFileSync('test-helper.pid', String(helper.pid));
  helper.unref();
`;

async function withHelperCleanup<T>(cwd: string, operation: () => Promise<T>): Promise<T> {
  let deadline: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error("Test operation exceeded its hard deadline.")), 5000); }),
    ]);
  } finally {
    if (deadline) clearTimeout(deadline);
    const pid = Number(await readFile(join(cwd, "test-helper.pid"), "utf8"));
    // Only this test-created helper is cleaned up; production never kills it.
    try { process.kill(pid, "SIGKILL"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}

test("protocol sends only the handshake and one metadata request", async (t) => {
  const options = await fakeHost(t, `
    import readline from 'node:readline';
    import { appendFileSync } from 'node:fs';
    const send = (value) => process.stdout.write(JSON.stringify(value) + '\\n');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const message = JSON.parse(line);
      appendFileSync('requests.jsonl', line + '\\n');
      if (message.method === 'initialize') {
        send({ method: 'startup/notice', params: { ignored: 'private' } });
        send({ id: message.id, result: { userAgent: 'fake' } });
      }
      if (message.method === 'skills/list') send({ id: message.id, result: { data: [{ cwd: process.cwd(), skills: [], errors: [] }] } });
    });
  `);
  const result = await querySkills(options);
  assert.equal(result.shutdownForced, false);
  assert.deepEqual(result.payload, { data: [{ cwd: options.cwd, skills: [], errors: [] }] });
  const requests = (await readFile(join(options.cwd, "requests.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line) as { method: string; params: unknown });
  assert.deepEqual(requests.map((request) => request.method), ["initialize", "initialized", "skills/list"]);
  assert.deepEqual(requests[2]?.params, { cwds: [options.cwd], forceReload: true });
});

test("server approval requests are rejected without replying or leaking contents", async (t) => {
  const options = await fakeHost(t, `
    process.stdin.once('data', () => process.stdout.write(JSON.stringify({ id: 999, method: 'item/commandExecution/requestApproval', params: { secret: 'PRIVATE_CANARY' } }) + '\\n'));
  `);
  await assert.rejects(querySkills(options), failureCode("UNEXPECTED_SERVER_REQUEST"));
});

test("native rejection is reduced to a code without native messages", async (t) => {
  const options = await fakeHost(t, `
    process.stdin.once('data', () => process.stdout.write(JSON.stringify({ id: 1, error: { message: 'PRIVATE_CANARY', code: 12 } }) + '\\n'));
    process.stderr.write('STDERR_PRIVATE_CANARY');
  `);
  await assert.rejects(querySkills(options), failureCode("INITIALIZE_REJECTED"));
});

test("invalid JSON is a protocol error", async (t) => {
  const options = await fakeHost(t, `process.stdin.once('data', () => process.stdout.write('not json\\n'));`);
  await assert.rejects(querySkills(options), failureCode("PROTOCOL_INVALID_JSON"));
});

test("a response for the wrong id cannot complete capture", async (t) => {
  const options = await fakeHost(t, `process.stdin.once('data', () => process.stdout.write('{"id":42,"result":{}}\\n'));`);
  await assert.rejects(querySkills(options), failureCode("PROTOCOL_UNEXPECTED_RESPONSE"));
});

test("a truncated response cannot become an empty successful inventory", async (t) => {
  const options = await fakeHost(t, `process.stdin.once('data', () => process.stdout.write('{"id":1', () => process.exit(0)));`);
  await assert.rejects(querySkills(options), failureCode("PROTOCOL_TRUNCATED_JSON"));
});

test("timeout terminates only the owned process and returns a bounded error", async (t) => {
  const options = await fakeHost(t, `setInterval(() => {}, 1000);`);
  const started = Date.now();
  await assert.rejects(querySkills({ ...options, timeoutMs: 50 }), failureCode("HOST_TIMEOUT"));
  assert.ok(Date.now() - started < 2000);
});

test("timeout settles when an exited host leaves a helper holding stdout", async (t) => {
  const options = await fakeHost(t, inheritedPipeHelper + `process.stdin.once('data', () => process.exit(0));`);
  await withHelperCleanup(options.cwd, async () => {
    await assert.rejects(querySkills({ ...options, timeoutMs: 1000 }), failureCode("HOST_TIMEOUT"));
    const pid = Number(await readFile(join(options.cwd, "test-helper.pid"), "utf8"));
    assert.doesNotThrow(() => process.kill(pid, 0));
  });
});

test("successful metadata settles with forced shutdown when a helper holds pipes", async (t) => {
  const options = await fakeHost(t, inheritedPipeHelper + `
    import readline from 'node:readline';
    readline.createInterface({ input: process.stdin }).on('line', (line) => {
      const message = JSON.parse(line);
      if (message.method === 'initialize') process.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\\n');
      if (message.method === 'skills/list') process.stdout.write(JSON.stringify({ id: 2, result: { data: [] } }) + '\\n', () => process.exit(0));
    });
  `);
  await withHelperCleanup(options.cwd, async () => {
    const result = await querySkills(options);
    assert.deepEqual(result.payload, { data: [] });
    assert.equal(result.shutdownForced, true);
    const pid = Number(await readFile(join(options.cwd, "test-helper.pid"), "utf8"));
    assert.doesNotThrow(() => process.kill(pid, 0));
  });
});

test("oversized protocol output is rejected", async (t) => {
  const options = await fakeHost(t, `process.stdin.once('data', () => process.stdout.write('x'.repeat(17 * 1024 * 1024)));`);
  await assert.rejects(querySkills(options), failureCode("PROTOCOL_OUTPUT_TOO_LARGE"));
});

test("version probing accepts only the expected codex version output", async (t) => {
  const options = await fakeHost(t, `if (process.argv[2] === '--version') console.log('codex-cli 0.166.0'); else process.exit(3);`);
  assert.equal(await probeVersion(options), "0.166.0");
});

test("invalid version output is not placed into reports", async (t) => {
  const options = await fakeHost(t, `console.log('private-token-not-a-version');`);
  await assert.rejects(probeVersion(options), failureCode("UNRECOGNIZED_HOST_VERSION"));
});

test("version strings cannot exceed the snapshot schema limit", async (t) => {
  const options = await fakeHost(t, `console.log('codex-cli ' + '1'.repeat(129) + '.0.0');`);
  await assert.rejects(probeVersion(options), failureCode("UNRECOGNIZED_HOST_VERSION"));
});

test("version probe has a hard deadline independent of inherited pipe closure", async (t) => {
  const options = await fakeHost(t, inheritedPipeHelper + `process.stdout.write('codex-cli 0.166.0\\n', () => process.exit(0));`);
  await withHelperCleanup(options.cwd, async () => {
    await assert.rejects(probeVersion({ ...options, timeoutMs: 1000 }), failureCode("VERSION_TIMEOUT"));
    const pid = Number(await readFile(join(options.cwd, "test-helper.pid"), "utf8"));
    assert.doesNotThrow(() => process.kill(pid, 0));
  });
});
