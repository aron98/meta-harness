import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MemoryRecord } from '@meta-harness/core';

import { runPromoteMemoryCommand } from '../src/promote-memory';

const tempDirectories: string[] = [];

const memoryRecord: MemoryRecord = {
  id: 'memory-001',
  scope: 'repo-local',
  repoId: 'meta-harness',
  kind: 'summary',
  value: 'CLI writes promoted repo-local memory into the store.',
  source: 'human-input',
  sourceArtifactIds: ['artifact-001'],
  confidence: 'high',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:30:00.000Z'
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runPromoteMemoryCommand', () => {
  it('writes the parsed memory record and prints a concise summary', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-promote-memory-'));
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    const result = await runPromoteMemoryCommand(
      ['--data-root', dataRoot, '--input', JSON.stringify(memoryRecord)],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.exitCode).toBe(0);
    expect(result.memoryId).toBe('memory-001');
    expect(result.filePath).toBe(join(dataRoot, 'data/memory/repo-local/meta-harness/memory-001.json'));
    expect(log).toHaveBeenCalledWith('Promoted memory memory-001 (repo-local)');
    await expect(readFile(result.filePath, 'utf8')).resolves.toContain('CLI writes promoted repo-local memory into the store.');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runPromoteMemoryCommand([], { log: vi.fn() }, { error });

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
