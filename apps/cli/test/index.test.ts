import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHelp, run } from '../src/index';

const execFile = promisify(execFileCallback);
const tempDirectories: string[] = [];

describe('renderHelp', () => {
  it('describes the scaffolded commands', () => {
    expect(renderHelp()).toContain('@meta-harness/core');
    expect(renderHelp()).toContain('pnpm test');
    expect(renderHelp()).toContain('build-fixture-artifacts');
    expect(renderHelp()).toContain('log-artifact');
    expect(renderHelp()).toContain('promote-memory');
    expect(renderHelp()).toContain('query-history');
    expect(renderHelp()).toContain('prepare-session');
  });
});

describe('run', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
  });

  it('prints help for the help path', async () => {
    const log = vi.fn();

    const result = await run(['--help'], { log }, { error: vi.fn() });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('build-fixture-artifacts');
    expect(log).toHaveBeenCalledWith(result.output);
  });

  it('reports unknown commands as errors', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const result = await run(['wat'], { log }, { error });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected unknown command to fail');
    }
    expect(result.error).toContain('error: cli failed: unknown command wat');
    expect(error).toHaveBeenCalledWith('error: cli failed: unknown command wat');
    expect(log).toHaveBeenCalledWith(renderHelp());
  });

  it('runs build-fixture-artifacts via injected builder', async () => {
    const log = vi.fn();
    const buildFixtureArtifacts = vi.fn().mockResolvedValue({
      writtenFiles: ['schemas/fixture-authoring.schema.json', 'fixtures/index.md']
    });

    const result = await run(['build-fixture-artifacts'], { log }, { error: vi.fn(), buildFixtureArtifacts });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(buildFixtureArtifacts).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenNthCalledWith(1, 'Wrote files:');
    expect(log).toHaveBeenNthCalledWith(2, '- schemas/fixture-authoring.schema.json');
    expect(log).toHaveBeenNthCalledWith(3, '- fixtures/index.md');
  });

  it('returns a failed result when build-fixture-artifacts rejects', async () => {
    const log = vi.fn();
    const error = vi.fn();
    const buildFixtureArtifacts = vi.fn().mockRejectedValue(new Error('disk full'));

    const result = await run(['build-fixture-artifacts'], { log }, { error, buildFixtureArtifacts });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    if (result.success) {
      throw new Error('expected build-fixture-artifacts rejection to fail');
    }
    expect(result.error).toContain('error: build-fixture-artifacts failed');
    expect(result.error).toContain('disk full');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('error: build-fixture-artifacts failed'));
    expect(log).not.toHaveBeenCalledWith(renderHelp());
  });

  it('starts the built CLI help path without sibling workspace dist outputs', async () => {
    await execFile('pnpm', ['--filter', '@meta-harness/cli', 'build'], {
      cwd: '/home/openclaw/.openclaw/workspace/projects/meta-harness/code/.worktrees/ux-hardening'
    });

    const result = await execFile('node', ['apps/cli/dist/index.js', '--help'], {
      cwd: '/home/openclaw/.openclaw/workspace/projects/meta-harness/code/.worktrees/ux-hardening'
    });

    expect(result.stdout).toContain('meta-harness CLI scaffold');
    expect(result.stdout).toContain('Available commands:');
  }, 120000);

  it('runs a built log-artifact command after the CLI build', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-built-command-'));
    const inputFile = join(dataRoot, 'artifact.json');

    tempDirectories.push(dataRoot);

    await writeFile(
      inputFile,
      JSON.stringify({
        id: 'artifact-built-smoke',
        taskType: 'fix',
        repoId: 'meta-harness',
        promptSummary: 'Built CLI smoke test artifact.',
        filesInspected: ['apps/cli/src/index.ts'],
        filesChanged: ['apps/cli/src/index.ts'],
        commands: ['pnpm --filter @meta-harness/cli build'],
        diagnostics: ['built smoke check'],
        verification: ['node apps/cli/dist/index.js log-artifact --json'],
        outcome: 'success',
        tags: ['cli', 'smoke'],
        createdAt: '2026-04-21T12:00:00.000Z'
      })
    );

    await execFile('pnpm', ['--filter', '@meta-harness/cli', 'build'], {
      cwd: '/home/openclaw/.openclaw/workspace/projects/meta-harness/code/.worktrees/ux-hardening'
    });

    const result = await execFile(
      'node',
      ['apps/cli/dist/index.js', 'log-artifact', '--data-root', dataRoot, '--input-file', inputFile, '--json'],
      {
        cwd: '/home/openclaw/.openclaw/workspace/projects/meta-harness/code/.worktrees/ux-hardening'
      }
    );

    expect(result.stdout).toContain('artifact-built-smoke');
    expect(result.stdout).toContain('data/artifacts/meta-harness/artifact-built-smoke.json');
  }, 120000);

  it('dispatches log-artifact via injected command handler', async () => {
    const log = vi.fn();
    const logArtifact = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'artifact-001'
    });

    const result = await run(['log-artifact', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      logArtifact
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'artifact-001' });
    expect(logArtifact).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches promote-memory via injected command handler', async () => {
    const log = vi.fn();
    const promoteMemory = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'memory-001'
    });

    const result = await run(['promote-memory', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      promoteMemory
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'memory-001' });
    expect(promoteMemory).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches query-history via injected command handler', async () => {
    const log = vi.fn();
    const queryHistory = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'history'
    });

    const result = await run(['query-history', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      queryHistory
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'history' });
    expect(queryHistory).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches prepare-session via injected command handler', async () => {
    const log = vi.fn();
    const prepareSession = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'packet-001'
    });

    const result = await run(['prepare-session', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      prepareSession
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'packet-001' });
    expect(prepareSession).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });
});
