import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord } from '@meta-harness/core';

import { runLogArtifactCommand } from '../src/log-artifact';

const tempDirectories: string[] = [];

const artifactRecord: ArtifactRecord = {
  id: 'artifact-001',
  taskType: 'codegen',
  repoId: 'meta-harness',
  taskId: 'task-123',
  promptSummary: 'Persist artifact records from the CLI.',
  filesInspected: ['apps/cli/src/index.ts'],
  filesChanged: ['apps/cli/src/log-artifact.ts'],
  commands: ['pnpm --filter @meta-harness/cli test'],
  diagnostics: ['artifact record stored'],
  verification: ['pnpm --filter @meta-harness/cli test -- log-artifact.test.ts'],
  outcome: 'success',
  cost: 0.02,
  latencyMs: 250,
  tags: ['phase-1', 'cli'],
  createdAt: '2026-04-21T12:00:00.000Z'
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runLogArtifactCommand', () => {
  it('writes the parsed artifact record and prints a concise summary', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-log-artifact-'));
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    const result = await runLogArtifactCommand(
      ['--data-root', dataRoot, '--input', JSON.stringify(artifactRecord)],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.exitCode).toBe(0);
    expect(result.recordId).toBe('artifact-001');
    expect(result.filePath).toBe(join(dataRoot, 'data/artifacts/meta-harness/artifact-001.json'));
    expect(log).toHaveBeenCalledWith('Logged artifact artifact-001 (success)');
    await expect(readFile(result.filePath, 'utf8')).resolves.toContain('Persist artifact records from the CLI.');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runLogArtifactCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing arguments to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('--data-root');
    expect(result.error).toContain('--input');
    expect(error).toHaveBeenCalledWith(result.error);
  });
});
