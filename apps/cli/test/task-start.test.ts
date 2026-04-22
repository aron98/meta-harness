import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, MemoryRecord } from '@meta-harness/core';

import { runTaskStartCommand } from '../src/task-start';

const tempDirectories: string[] = [];

const memoryRecords: MemoryRecord[] = [
  {
    id: 'memory-build',
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    value: 'Run pnpm build after TypeScript edits.',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T11:00:00.000Z'
  }
];

const artifactRecords: ArtifactRecord[] = [
  {
    id: 'artifact-build',
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
  }
];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runTaskStartCommand', () => {
  it('writes the prepared runtime context and prints a concise summary', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-task-start-'));
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    const result = await runTaskStartCommand(
      [
        '--data-root',
        dataRoot,
        '--input',
        JSON.stringify({
          packetId: 'packet-001',
          repoId: 'repo-a',
          taskId: 'task-001',
          prompt: 'Implement a fix for the broken TypeScript build and verify it.',
          maxMemories: 1,
          maxArtifacts: 1,
          referenceTime: '2026-04-21T12:00:00.000Z'
        })
      ],
      { log },
      {
        error: vi.fn(),
        listMemoryRecords: vi.fn().mockResolvedValue(memoryRecords),
        listArtifactRecords: vi.fn().mockResolvedValue(artifactRecords)
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.exitCode).toBe(0);
    expect(result.filePath).toBe(join(dataRoot, 'data/runtime/task-start/repo-a/task-001.json'));
    expect(result.taskStart.id).toBe('packet-001-start');
    expect(result.context.packet.id).toBe('packet-001');
    expect(result.context.packet.selectedMemoryIds).toEqual(['memory-build']);
    expect(result.context.packet.selectedArtifactIds).toEqual(['artifact-build']);
    expect(log).toHaveBeenNthCalledWith(1, 'Prepared runtime context packet-001 for task task-001 (verification/verify)');
    expect(log).toHaveBeenNthCalledWith(2, 'Selected 1 memories and 1 artifacts');
    await expect(readFile(result.filePath, 'utf8')).resolves.toContain('Implement a fix for the broken TypeScript build and verify it.');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runTaskStartCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing arguments to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('error: task-start failed: missing required --data-root and one of --input or --input-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('accepts --input-file and emits machine-readable output with warnings', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-task-start-'));
    const inputFile = join(dataRoot, 'task-start.json');
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    await writeFile(
      inputFile,
      `${JSON.stringify(
        {
          packetId: 'packet-002',
          repoId: 'repo-a',
          taskId: 'task-002',
          prompt: 'Implement a fix for the broken TypeScript build and verify it.',
          maxMemories: 1,
          maxArtifacts: 1,
          referenceTime: '2026-04-21T12:00:00.000Z'
        },
        null,
        2
      )}\n`
    );

    const result = await runTaskStartCommand(
      ['--data-root', dataRoot, '--input-file', inputFile, '--json'],
      { log },
      {
        error: vi.fn(),
        listMemoryRecords: vi.fn().mockResolvedValue({
          records: memoryRecords,
          warnings: ['warning: skipped memory record ignored.json']
        }),
        listArtifactRecords: vi.fn().mockResolvedValue({
          records: artifactRecords,
          warnings: ['warning: skipped artifact record ignored.json']
        })
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      filePath: join(dataRoot, 'data/runtime/task-start/repo-a/task-002.json'),
      taskStart: result.taskStart,
      context: result.context,
      warnings: ['warning: skipped memory record ignored.json', 'warning: skipped artifact record ignored.json']
    });
    expect(log).toHaveBeenCalledWith(result.output);
  });
});
