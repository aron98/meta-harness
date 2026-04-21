import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, MemoryRecord } from '@meta-harness/core';

import { runPrepareSessionCommand } from '../src/prepare-session';

const memories: MemoryRecord[] = [
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

const artifacts: ArtifactRecord[] = [
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

describe('runPrepareSessionCommand', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
  });

  it('prepares a packet from parsed input and concise history context', async () => {
    const log = vi.fn();
    const listMemoryRecords = vi.fn().mockResolvedValue(memories);
    const listArtifactRecords = vi.fn().mockResolvedValue(artifacts);

    const result = await runPrepareSessionCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--input',
        JSON.stringify({
          packetId: 'packet-001',
          repoId: 'repo-a',
          prompt: 'Implement a fix for the broken TypeScript build and verify it.',
          maxMemories: 1,
          maxArtifacts: 1,
          referenceTime: '2026-04-21T12:00:00.000Z'
        })
      ],
      { log },
      { error: vi.fn(), listMemoryRecords, listArtifactRecords }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.exitCode).toBe(0);
    expect(result.packet.id).toBe('packet-001');
    expect(result.packet.selectedMemoryIds).toEqual(['memory-build']);
    expect(result.packet.selectedArtifactIds).toEqual(['artifact-build']);
    expect(log).toHaveBeenNthCalledWith(1, 'Prepared session packet packet-001 (verification/verify)');
    expect(log).toHaveBeenNthCalledWith(2, 'Selected 1 memories and 1 artifacts');
  });

  it('returns a failed result when required input is missing', async () => {
    const error = vi.fn();

    const result = await runPrepareSessionCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing input to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('--data-root');
    expect(result.error).toContain('--input');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('skips malformed stored files and still prepares a packet from valid records', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-prepare-session-'));
    const log = vi.fn();
    const error = vi.fn();

    tempDirectories.push(dataRoot);

    await mkdir(join(dataRoot, 'data/memory/repo-local/repo-a'), { recursive: true });
    await mkdir(join(dataRoot, 'data/artifacts/repo-a'), { recursive: true });
    await writeFile(
      join(dataRoot, 'data/memory/repo-local/repo-a/memory-build.json'),
      `${JSON.stringify(memories[0], null, 2)}\n`
    );
    await writeFile(join(dataRoot, 'data/memory/repo-local/repo-a/bad-memory.json'), '{not json\n');
    await writeFile(
      join(dataRoot, 'data/artifacts/repo-a/artifact-build.json'),
      `${JSON.stringify(artifacts[0], null, 2)}\n`
    );
    await writeFile(join(dataRoot, 'data/artifacts/repo-a/bad-artifact.json'), '{not json\n');

    const result = await runPrepareSessionCommand(
      [
        '--data-root',
        dataRoot,
        '--input',
        JSON.stringify({
          packetId: 'packet-002',
          repoId: 'repo-a',
          prompt: 'Implement a fix for the broken TypeScript build and verify it.',
          maxMemories: 1,
          maxArtifacts: 1,
          referenceTime: '2026-04-21T12:00:00.000Z'
        })
      ],
      { log },
      { error }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.packet.id).toBe('packet-002');
    expect(result.packet.selectedMemoryIds).toEqual(['memory-build']);
    expect(result.packet.selectedArtifactIds).toEqual(['artifact-build']);
    expect(result.warnings).toEqual([
      'Warning: skipped memory record bad-memory.json',
      'Warning: skipped artifact record bad-artifact.json'
    ]);
    expect(log).toHaveBeenCalledWith('Warning: skipped memory record bad-memory.json');
    expect(log).toHaveBeenCalledWith('Warning: skipped artifact record bad-artifact.json');
    expect(error).not.toHaveBeenCalled();
  });
});
