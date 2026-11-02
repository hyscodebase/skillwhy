import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCandidateBuild } from '../scripts/native-conformance.mjs';
import * as production from '../dist/src/compatibility.js';

test('a native candidate changes only its temporary compiled support predicate', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'skillwhy-candidate-test-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const originalUrl = new URL('../dist/src/compatibility.js', import.meta.url);
  const originalBytes = await readFile(originalUrl);
  const candidateCli = await createCandidateBuild(temporary);
  const candidate = await import(pathToFileURL(join(dirname(candidateCli), 'compatibility.js')).href);
  assert.equal(production.isSupportedNativeHost('0.166.0', 'linux', 'x64'), false);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'linux', 'x64'), true);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'linux', 'arm64'), false);
  assert.equal(candidate.isSupportedNativeHost('0.167.0', 'linux', 'x64'), false);
  assert.equal(candidate.isSupportedNativeHost('0.166.0', 'darwin', 'arm64'), true);
  assert.deepEqual(candidate.SUPPORTED_NATIVE_HOSTS, production.SUPPORTED_NATIVE_HOSTS);
  assert.deepEqual(await readFile(originalUrl), originalBytes);
});
