import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, MemoryRecord, RetrievalQuery } from '@meta-harness/core';

import { listArtifactRecordsFromStore, runQueryHistoryCommand } from '../src/query-history';

const query: RetrievalQuery = {
  repoId: 'repo-a',
  taskType: 'fix',
  tags: ['build', 'typescript'],
  preferredOutcome: 'success',
  referenceTime: '2026-04-21T12:00:00.000Z'
};

const memories: MemoryRecord[] = [
  {
    id: 'memory-top',
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    value: 'Fix the TypeScript build before editing config defaults.',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T11:00:00.000Z'
  },
  {
    id: 'memory-low',
    scope: 'repo-local',
    repoId: 'repo-b',
    kind: 'summary',
    value: 'Different repo memory.',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'medium',
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T11:00:00.000Z'
  }
];

const artifacts: ArtifactRecord[] = [
  {
    id: 'artifact-top',
    taskType: 'fix',
    repoId: 'repo-a',
    promptSummary: 'Fix the TypeScript build',
    filesInspected: ['package.json'],
    filesChanged: ['tsconfig.json'],
    commands: ['pnpm build'],
    diagnostics: [],
    verification: ['pnpm build'],
    outcome: 'success',
    tags: ['build', 'typescript', 'success'],
    createdAt: '2026-04-21T11:30:00.000Z'
  },
  {
    id: 'artifact-low',
    taskType: 'analysis',
    repoId: 'repo-b',
    promptSummary: 'Inspect another repo',
    filesInspected: ['README.md'],
    filesChanged: [],
    commands: ['pnpm test'],
    diagnostics: [],
    verification: ['pnpm test'],
    outcome: 'partial',
    tags: ['docs'],
    createdAt: '2026-04-01T11:30:00.000Z'
  }
];

describe('runQueryHistoryCommand', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
  });

  it('ranks history records and prints the top matches', async () => {
    const log = vi.fn();
    const listMemoryRecords = vi.fn().mockResolvedValue(memories);
    const listArtifactRecords = vi.fn().mockResolvedValue(artifacts);

    const result = await runQueryHistoryCommand(
      ['--data-root', '/tmp/meta-harness', '--input', JSON.stringify({ ...query, limit: 1 })],
      { log },
      { error: vi.fn(), listMemoryRecords, listArtifactRecords }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.exitCode).toBe(0);
    expect(result.query.repoId).toBe('repo-a');
    expect(result.memories.map((entry) => entry.record.id)).toEqual(['memory-top']);
    expect(result.artifacts.map((entry) => entry.record.id)).toEqual(['artifact-top']);
    expect(log).toHaveBeenNthCalledWith(1, 'Top memories: memory-top');
    expect(log).toHaveBeenNthCalledWith(2, 'Top artifacts: artifact-top');
  });

  it('returns a failed result when input is invalid', async () => {
    const error = vi.fn();

    const result = await runQueryHistoryCommand(
      ['--data-root', '/tmp/meta-harness', '--input', JSON.stringify({ taskType: 'fix', tags: [] })],
      { log: vi.fn() },
      { error }
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected invalid input to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('error: query-history failed');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('skips malformed stored files and surfaces warnings while still succeeding', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-query-history-'));
    const log = vi.fn();
    const error = vi.fn();

    tempDirectories.push(dataRoot);

    await mkdir(join(dataRoot, 'data/memory/repo-local/repo-a'), { recursive: true });
    await mkdir(join(dataRoot, 'data/artifacts/repo-a'), { recursive: true });
    await writeFile(
      join(dataRoot, 'data/memory/repo-local/repo-a/memory-top.json'),
      `${JSON.stringify(memories[0], null, 2)}\n`
    );
    await writeFile(join(dataRoot, 'data/memory/repo-local/repo-a/bad-memory.json'), '{not json\n');
    await writeFile(
      join(dataRoot, 'data/artifacts/repo-a/artifact-top.json'),
      `${JSON.stringify(artifacts[0], null, 2)}\n`
    );
    await writeFile(join(dataRoot, 'data/artifacts/repo-a/bad-artifact.json'), '{not json\n');

    const result = await runQueryHistoryCommand(
      ['--data-root', dataRoot, '--input', JSON.stringify({ ...query, limit: 1 })],
      { log },
      { error }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.memories.map((entry) => entry.record.id)).toEqual(['memory-top']);
    expect(result.artifacts.map((entry) => entry.record.id)).toEqual(['artifact-top']);
    expect(result.warnings).toEqual([
      'warning: skipped memory record bad-memory.json',
      'warning: skipped artifact record bad-artifact.json'
    ]);
    expect(log).toHaveBeenCalledWith('warning: skipped memory record bad-memory.json');
    expect(log).toHaveBeenCalledWith('warning: skipped artifact record bad-artifact.json');
    expect(error).not.toHaveBeenCalled();
  });

  it('fails when the loader hits an operational read error', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-query-history-'));
    const error = vi.fn();

    tempDirectories.push(dataRoot);

    await mkdir(join(dataRoot, 'data/artifacts/repo-a'), { recursive: true });
    await writeFile(
      join(dataRoot, 'data/artifacts/repo-a/artifact-top.json'),
      `${JSON.stringify(artifacts[0], null, 2)}\n`
    );

    const result = await runQueryHistoryCommand(
      ['--data-root', dataRoot, '--input', JSON.stringify({ ...query, limit: 1 })],
      { log: vi.fn() },
      {
        error,
        listMemoryRecords: vi.fn().mockResolvedValue([]),
        listArtifactRecords: (root) =>
          listArtifactRecordsFromStore(root, {
            readTextFile: async () => {
              const readFailure = new Error('permission denied') as NodeJS.ErrnoException;

              readFailure.code = 'EACCES';
              throw readFailure;
            }
          })
      }
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected operational read error to fail');
    }
    expect(result.error).toContain('permission denied');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('accepts --input-file and emits JSON results with --json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-query-history-'));
    const inputFile = join(dataRoot, 'query.json');
    const log = vi.fn();
    const error = vi.fn();

    tempDirectories.push(dataRoot);

    await writeFile(inputFile, `${JSON.stringify({ ...query, limit: 1 }, null, 2)}\n`);

    const result = await runQueryHistoryCommand(
      ['--data-root', dataRoot, '--input-file', inputFile, '--json'],
      { log },
      {
        error,
        listMemoryRecords: vi.fn().mockResolvedValue({
          records: memories,
          warnings: ['warning: skipped memory record ignored.json']
        }),
        listArtifactRecords: vi.fn().mockResolvedValue({
          records: artifacts,
          warnings: ['warning: skipped artifact record ignored.json']
        })
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      query,
      memories: result.memories,
      artifacts: result.artifacts,
      warnings: ['warning: skipped memory record ignored.json', 'warning: skipped artifact record ignored.json']
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(result.output);
    expect(error).not.toHaveBeenCalled();
  });
});
