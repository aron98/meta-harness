import { describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, MemoryRecord } from '@meta-harness/core';

import { runInspectRetrievalCommand } from '../src/inspect-retrieval';

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
    taskType: 'verification',
    repoId: 'repo-a',
    promptSummary: 'Verify the release build',
    filesInspected: ['package.json'],
    filesChanged: [],
    commands: ['pnpm build'],
    diagnostics: ['Build completed without TypeScript errors.'],
    verification: ['pnpm build'],
    outcome: 'success',
    tags: ['verify', 'build', 'release'],
    createdAt: '2026-04-21T11:30:00.000Z'
  }
];

describe('runInspectRetrievalCommand', () => {
  it('prints the selected records, scores, and reasons', async () => {
    const log = vi.fn();

    const result = await runInspectRetrievalCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--input',
        JSON.stringify({
          repoId: 'repo-a',
          taskType: 'verification',
          tags: ['verify', 'build', 'release'],
          preferredOutcome: 'success',
          referenceTime: '2026-04-21T12:10:00.000Z',
          maxMemories: 1,
          maxArtifacts: 1
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
    expect(result.inspection.selectedMemories).toHaveLength(1);
    expect(result.inspection.selectedArtifacts).toHaveLength(1);
    expect(result.inspection.selectedMemories[0]?.record.id).toBe('memory-build');
    expect(result.inspection.selectedArtifacts[0]?.record.id).toBe('artifact-build');
    expect(log).toHaveBeenNthCalledWith(1, 'Selected memories:');
    expect(log).toHaveBeenNthCalledWith(2, expect.stringContaining('memory-build'));
    expect(log).toHaveBeenNthCalledWith(3, 'Selected artifacts:');
    expect(log).toHaveBeenNthCalledWith(4, expect.stringContaining('artifact-build'));
    expect(log).toHaveBeenNthCalledWith(4, expect.stringContaining('repo-match'));
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runInspectRetrievalCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing arguments to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('error: inspect-retrieval failed: missing required --data-root and one of --input or --input-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('emits machine-readable inspection output with warnings', async () => {
    const log = vi.fn();

    const result = await runInspectRetrievalCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--input',
        JSON.stringify({
          repoId: 'repo-a',
          taskType: 'verification',
          tags: ['verify', 'build', 'release'],
          preferredOutcome: 'success',
          referenceTime: '2026-04-21T12:10:00.000Z',
          maxMemories: 1,
          maxArtifacts: 1
        }),
        '--json'
      ],
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
      query: result.query,
      inspection: result.inspection,
      warnings: ['warning: skipped memory record ignored.json', 'warning: skipped artifact record ignored.json']
    });
    expect(log).toHaveBeenCalledWith(result.output);
  });
});
