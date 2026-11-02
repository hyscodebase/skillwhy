import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createCandidateBuild } from '../scripts/native-conformance.mjs';
import * as production from '../dist/src/compatibility.js';

test('the experimental build helper preserves production code and the reviewed manifest', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'skillwhy-candidate-test-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const originalUrl = new URL('../dist/src/compatibility.js', import.meta.url);
  const originalBytes = await readFile(originalUrl);
  const candidateCli = await createCandidateBuild(temporary);
  const candidate = await import(pathToFileURL(join(dirname(candidateCli), 'compatibility.js')).href);
  assert.equal(production.isSupportedNativeHost('0.166.0', 'linux', 'x64'), true);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'linux', 'x64'), true);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'linux', 'arm64'), false);
  assert.equal(candidate.isSupportedNativeHost('0.167.0', 'linux', 'x64'), false);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'darwin', 'arm64'), true);
  assert.deepEqual(candidate.SUPPORTED_NATIVE_HOSTS, production.SUPPORTED_NATIVE_HOSTS);
  assert.deepEqual(await readFile(originalUrl), originalBytes);
});

test('the candidate CLI refuses an already reviewed tuple before starting a host', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/native-conformance.mjs', import.meta.url)),
    '--live', '--candidate', 'linux-x64', '--codex-bin', '/nonexistent-skillwhy-host',
  ], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stderr);
  assert.equal(report.status, 'failed');
  assert.equal(report.code, process.platform === 'linux' && process.arch === 'x64'
    ? 'CANDIDATE_ALREADY_SUPPORTED' : 'CANDIDATE_PLATFORM_MISMATCH');
});
