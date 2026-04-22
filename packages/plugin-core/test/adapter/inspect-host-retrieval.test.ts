import { describe, expect, it } from 'vitest';

import {
  inspectRetrieval,
  rankArtifacts,
  rankMemories,
  type ArtifactRecord,
  type MemoryRecord
} from '@meta-harness/core';

import { inspectHostRetrieval } from '../../src/index';

function createMemoryRecord(overrides: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'value'>): MemoryRecord {
  const { id, value, ...rest } = overrides;

  return {
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-10T12:00:00.000Z',
    updatedAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id,
    value
  };
}

function createArtifactRecord(overrides: Partial<ArtifactRecord> & Pick<ArtifactRecord, 'id'>): ArtifactRecord {
  const { id, ...rest } = overrides;

  return {
    taskType: 'fix',
    repoId: 'repo-a',
    promptSummary: 'Fix the TypeScript build',
    filesInspected: ['package.json'],
    filesChanged: ['tsconfig.json'],
    commands: ['pnpm build'],
    diagnostics: [],
    verification: ['pnpm build'],
    outcome: 'success',
    tags: ['build', 'typescript'],
    createdAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id
  };
}

describe('inspectHostRetrieval', () => {
  it('reuses the existing retrieval inspection helper without changing ranking output', () => {
    const rankedMemories = rankMemories(
      {
        repoId: 'repo-a',
        taskType: 'fix',
        tags: ['build', 'typescript'],
        referenceTime: '2026-04-21T12:00:00.000Z'
      },
      [
        createMemoryRecord({ id: 'memory-1', value: 'Fix the TypeScript build first' }),
        createMemoryRecord({ id: 'memory-2', value: 'Run pnpm test after the fix' })
      ]
    );
    const rankedArtifacts = rankArtifacts(
      {
        repoId: 'repo-a',
        taskType: 'fix',
        tags: ['build', 'typescript'],
        preferredOutcome: 'success',
        referenceTime: '2026-04-21T12:00:00.000Z'
      },
      [
        createArtifactRecord({ id: 'artifact-1' }),
        createArtifactRecord({ id: 'artifact-2', tags: ['verify', 'test'] })
      ]
    );

    expect(
      inspectHostRetrieval({
        rankedMemories,
        rankedArtifacts,
        maxMemories: 1,
        maxArtifacts: 1
      })
    ).toEqual(
      inspectRetrieval({
        rankedMemories,
        rankedArtifacts,
        maxMemories: 1,
        maxArtifacts: 1
      })
    );
  });
});
