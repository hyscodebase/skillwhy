#!/usr/bin/env node
// Opt-in live metadata checks. This script never changes user configuration.
import { constants } from 'node:fs';
import { access, chmod, cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(repo, 'dist', 'src', 'cli.js');
const expectedVersion = '0.166.0';
const bodyCanary = 'SKILLWHY_NATIVE_FIXTURE_BODY_NOT_FOR_EXPORT';

class CheckFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
function check(condition, code) { if (!condition) throw new CheckFailure(code); }
function shellQuote(value) { return `'${value.replaceAll("'", "'\\''")}'`; }

async function findExecutable(binary) {
  const candidates = isAbsolute(binary) || binary.includes(sep)
    ? [resolve(binary)]
    : (process.env.PATH ?? '').split(delimiter).filter(Boolean).map(directory => resolve(directory, binary));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const canonical = await realpath(candidate);
      if ((await stat(canonical)).isFile()) return canonical;
    } catch { /* Do not expose local executable paths or OS errors. */ }
  }
  throw new CheckFailure('CODEX_NOT_FOUND');
}

function runCli(args, expectedExit = 0, cliPath = cli) {
  let output;
  let status = 0;
  try {
    output = execFileSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024, timeout: 45_000, killSignal: 'SIGKILL',
    });
  } catch (error) {
    status = error.status;
    output = error.stdout;
  }
  check(status === expectedExit, `CLI_${args[0].toUpperCase()}_EXIT_${Number.isInteger(status) ? status : 'UNKNOWN'}_UNEXPECTED`);
  check(typeof output === 'string', 'CLI_OUTPUT_UNAVAILABLE');
  return output;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

/** Test-only candidate: copy compiled code and override one pure predicate there. */
export async function createCandidateBuild(temporary) {
  const candidate = join(temporary, 'candidate-build');
  await mkdir(candidate, { mode: 0o700 });
  await cp(join(repo, 'dist', 'src'), join(candidate, 'dist', 'src'), { recursive: true, errorOnExist: true, force: false });
  await cp(join(repo, 'package.json'), join(candidate, 'package.json'), { errorOnExist: true, force: false });
  const original = pathToFileURL(join(repo, 'dist', 'src', 'compatibility.js')).href;
  const override = `// Temporary conformance override; never published.\n` +
    `import * as production from ${JSON.stringify(original)};\n` +
    `export * from ${JSON.stringify(original)};\n` +
    `export function isSupportedNativeHost(version, platform = process.platform, arch = process.arch) {\n` +
    `  return production.isSupportedNativeHost(version, platform, arch) ||\n` +
    `    (version === ${JSON.stringify(expectedVersion)} && platform === 'linux' && arch === 'x64');\n` +
    `}\n`;
  await writeFile(join(candidate, 'dist', 'src', 'compatibility.js'), override, { mode: 0o600 });
  return join(candidate, 'dist', 'src', 'cli.js');
}

async function runNative(binary, candidateTarget) {
  check(candidateTarget === undefined || candidateTarget === 'linux-x64', 'UNSUPPORTED_CANDIDATE');
  check(Number(process.versions.node.split('.')[0]) >= 22, 'UNSUPPORTED_NODE');
  await access(cli).catch(() => { throw new CheckFailure('BUILD_REQUIRED'); });
  const production = await import(pathToFileURL(join(repo, 'dist', 'src', 'compatibility.js')).href);
  const productionSupported = production.isSupportedNativeHost(expectedVersion);
  if (candidateTarget !== undefined) {
    check(process.platform === 'linux' && process.arch === 'x64', 'CANDIDATE_PLATFORM_MISMATCH');
    check(!productionSupported, 'CANDIDATE_ALREADY_SUPPORTED');
  } else {
    check(productionSupported, 'UNSUPPORTED_PLATFORM');
  }
  const executable = await findExecutable(binary);
  let version;
  try {
    version = execFileSync(executable, ['--version'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5_000, maxBuffer: 64 * 1024,
    }).trim();
  } catch { throw new CheckFailure('VERSION_PROBE_FAILED'); }
  check(version === `codex-cli ${expectedVersion}`, 'UNSUPPORTED_CODEX_VERSION');

  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'skillwhy-native-')));
  await chmod(temporary, 0o700);
  try {
    // Check that the shipped CLI rejects this unreviewed combination first.
    if (candidateTarget !== undefined) {
      const unsupportedFile = join(temporary, 'production-unsupported.private.json');
      runCli(['capture', '--cwd', temporary, '--out', unsupportedFile, '--codex-bin', executable], 2);
      const unsupported = await readJson(unsupportedFile);
      check(unsupported.capture.status === 'unsupported' && unsupported.entries.length === 0 &&
        unsupported.errors.some(error => error.code === 'UNSUPPORTED_HOST_COMBINATION'), 'PRODUCTION_SUPPORT_GATE_CHANGED');
    }
    const activeCli = candidateTarget === undefined ? cli : await createCandidateBuild(temporary);
    const invoke = (args, expectedExit = 0) => runCli(args, expectedExit, activeCli);
    const project = join(temporary, 'project');
    const skills = join(project, '.agents', 'skills');
    const unique = randomUUID().slice(0, 8);
    const targetName = `skillwhy-native-target-${unique}`;
    const duplicateName = `skillwhy-native-duplicate-${unique}`;
    async function fixture(directory, name, body = bodyCanary) {
      const path = join(skills, directory, 'SKILL.md');
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, `---\nname: ${name}\ndescription: Temporary metadata conformance fixture; never execute.\n---\n${body}\n`, { mode: 0o600 });
      return path;
    }
    const target = await fixture('target', targetName);
    const duplicateA = await fixture('duplicate-a', duplicateName);
    const duplicateB = await fixture('duplicate-b', duplicateName);
    const beforeFile = join(temporary, 'before.private.json');
    const afterFile = join(temporary, 'after.private.json');
    const disabledFile = join(temporary, 'disabled.private.json');
    const malformedFile = join(temporary, 'malformed.private.json');
    const shareFile = join(temporary, 'selected.share.json');
    const capture = async (out, host = executable, expectedExit = 0) => {
      try {
        invoke(['capture', '--cwd', project, '--out', out, '--codex-bin', host, '--digest', '--timeout-ms', '10000'], expectedExit);
      } catch (error) {
        // Snapshot error codes are authored by SkillWhy; raw native messages are absent.
        const failed = await readJson(out).catch(() => null);
        if (failed?.errors?.length) {
          const codes = failed.errors.map(item => item.code).filter(code => /^[A-Z_]+$/.test(code));
          if (codes.length) throw new CheckFailure(`CAPTURE_${codes.join('_')}`);
        }
        throw error;
      }
      return readJson(out);
    };

    const before = await capture(beforeFile);
    check(before.capture.status === 'complete' && before.errors.length === 0, 'BASELINE_INVENTORY_INCOMPLETE');
    const baselineTarget = before.entries.find(entry => entry.sourcePath === target);
    check(baselineTarget?.enabled === true && baselineTarget.content.status === 'collected', 'ENABLED_FIXTURE_NOT_OBSERVED');
    const duplicates = before.entries.filter(entry => entry.name === duplicateName);
    check(duplicates.length === 2 && duplicates.some(entry => entry.sourcePath === duplicateA) && duplicates.some(entry => entry.sourcePath === duplicateB), 'DUPLICATES_NOT_PRESERVED');
    check(before.findings.some(finding => finding.code === 'DUPLICATE_NAME_RETURNED' && duplicates.every(entry => finding.entryIds.includes(entry.entryId))), 'DUPLICATE_FINDING_MISSING');

    await fixture('target', targetName, `${bodyCanary}\nA controlled byte change.`);
    const after = await capture(afterFile);
    const changedTarget = after.entries.find(entry => entry.sourcePath === target);
    check(changedTarget?.content.status === 'collected' && changedTarget.content.digest !== baselineTarget.content.digest, 'DIGEST_CHANGE_NOT_OBSERVED');
    const changed = JSON.parse(invoke(['diff', beforeFile, afterFile, '--map-root', 'project=project', '--json']));
    check(changed.status === 'complete' && changed.differences.filter(item => item.kind === 'content-changed').length === 1, 'CONTENT_DIFF_INCORRECT');
    invoke(['share', '--snapshot', afterFile, '--entry', changedTarget.entryId, '--alias', 'native-fixture', '--include-digest', '--out', shareFile]);
    const shared = await readJson(shareFile);
    const serialized = JSON.stringify(shared);
    check(shared.artifactKind === 'share-v1' && shared.entries.length === 1 && shared.entries[0].name === null, 'SHARE_SELECTION_INCORRECT');
    check(!Object.hasOwn(shared.entries[0], 'sourcePath') && !serialized.includes(temporary) && !serialized.includes(bodyCanary) && !serialized.includes(targetName) && !serialized.includes(duplicateName), 'SHARE_DISCLOSURE_UNEXPECTED');
    check(shared.entries[0].content.digest === changedTarget.content.digest, 'SHARE_DIGEST_MISMATCH');

    // A fixture-only launcher adds a session override; it never writes config.toml.
    // exec replaces the launcher, so it does not introduce another long-lived child.
    const wrapper = join(temporary, 'codex-fixture-wrapper');
    const override = `skills.config=[{path=${JSON.stringify(target)},enabled=false}]`;
    await writeFile(wrapper, `#!/bin/sh\nexec ${shellQuote(executable)} -c ${shellQuote(override)} "$@"\n`, { mode: 0o700 });
    const disabled = await capture(disabledFile, wrapper);
    check(disabled.entries.find(entry => entry.sourcePath === target)?.enabled === false, 'DISABLED_FIXTURE_NOT_OBSERVED');
    const disabledDiff = JSON.parse(invoke(['diff', afterFile, disabledFile, '--map-root', 'project=project', '--json']));
    check(disabledDiff.status === 'complete' && disabledDiff.differences.some(item => item.kind === 'enabled-changed' && item.before === true && item.after === false), 'DISABLED_DIFF_INCORRECT');

    const malformed = join(skills, 'malformed', 'SKILL.md');
    await mkdir(dirname(malformed), { recursive: true, mode: 0o700 });
    // A missing required description is rejected by this pinned native version.
    // Do not assume that YAML-looking syntax is itself rejected by the host.
    await writeFile(malformed, `---\nname: skillwhy-missing-description-${unique}\n---\nRequired description deliberately omitted.\n`, { mode: 0o600 });
    const broken = await capture(malformedFile, executable, 2);
    check(broken.capture.status === 'partial' && broken.coverage.inventory === 'partial', 'MALFORMED_COVERAGE_NOT_PARTIAL');
    check(broken.errors.some(error => error.code === 'NATIVE_SKILL_ERRORS'), 'MALFORMED_ERROR_NOT_OBSERVED');
    check(!broken.entries.some(entry => entry.sourcePath === malformed), 'MALFORMED_ENTRY_UNEXPECTEDLY_RETURNED');
    check(broken.entries.find(entry => entry.sourcePath === target)?.enabled === true, 'SESSION_OVERRIDE_PERSISTED_OR_TARGET_MISSING');
    const brokenDiff = JSON.parse(invoke(['diff', afterFile, malformedFile, '--map-root', 'project=project', '--json'], 2));
    check(brokenDiff.status === 'inconclusive' && !brokenDiff.differences.some(item => item.kind === 'not-returned' || item.kind === 'added'), 'PARTIAL_DIFF_OVERCLAIMED');

    return {
      suite: 'skillwhy-native-conformance-v1', status: 'passed', checkedAt: new Date().toISOString(),
      hostVersion: expectedVersion, adapterVersion: before.capture.adapterVersion,
      platform: process.platform, arch: process.arch, nodeVersion: process.versions.node,
      buildMode: candidateTarget === undefined ? 'production' : 'temporary-candidate',
      candidateTarget: candidateTarget ?? null, productionSupported,
      sourceRevision: /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null,
      cases: ['enabled-project-fixture', 'duplicate-names-preserved', 'changed-skill-digest',
        'cli-capture-diff-share', 'minimal-selected-share', 'session-disabled-fixture',
        'enabled-state-diff', 'missing-description-partial', 'partial-diff-inconclusive', 'session-override-not-persisted'],
      scope: 'Fresh CLI metadata for temporary fixtures only; no model turns or skill execution.',
      privacy: 'No raw inventory, user configuration, paths, or stderr are included in this report.',
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function main() {
 try {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, help: { type: 'boolean' }, 'codex-bin': { type: 'string' }, candidate: { type: 'string' } } });
  if (values.help || !values.live) {
    console.log('Usage: node scripts/native-conformance.mjs --live [--codex-bin PATH] [--candidate linux-x64]\nBuild first with npm run build. Requires Codex 0.166.0 and a reviewed platform.\nA candidate run changes only a temporary compiled copy; it does not grant production support.\nStarts fresh metadata-only processes; native startup may write caches/logs or use the network.\nUses temporary fixtures and a session-only config override. User configuration is not written.');
    if (!values.help) process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await runNative(values['codex-bin'] ?? 'codex', values.candidate), null, 2));
  }
} catch (error) {
  // Error objects from child processes can include full commands and native output.
  const code = error instanceof CheckFailure ? error.code : 'NATIVE_CONFORMANCE_FAILED';
  console.error(JSON.stringify({ suite: 'skillwhy-native-conformance-v1', status: 'failed', code }));
  process.exitCode = 2;
 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
