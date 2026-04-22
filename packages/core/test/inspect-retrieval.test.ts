import { describe, expect, it } from 'vitest';

import {
  inspectRetrieval,
  type ArtifactRecord,
  type MemoryRecord,
  type ScoredRetrieval
} from '../src/index';

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

describe('inspectRetrieval', () => {
  it('returns selected records with scores and reasons', () => {
    const memory = createMemoryRecord({ id: 'memory-build', value: 'Fix the TypeScript build first' });
    const artifact = createArtifactRecord({ id: 'artifact-build' });

    const inspection = inspectRetrieval({
      rankedMemories: [{ record: memory, score: 14, reasons: ['repo-match', 'tag-overlap'] }],
      rankedArtifacts: [{ record: artifact, score: 22, reasons: ['repo-match', 'task-type-match', 'recent'] }]
    });

    expect(inspection.selectedMemories).toEqual([
      {
        record: memory,
        score: 14,
        reasons: ['repo-match', 'tag-overlap']
      }
    ]);
    expect(inspection.selectedArtifacts).toEqual([
      {
        record: artifact,
        score: 22,
        reasons: ['repo-match', 'task-type-match', 'recent']
      }
    ]);
  });

  it('caps selected results without reordering them', () => {
    const rankedMemories: ScoredRetrieval<MemoryRecord>[] = [
      { record: createMemoryRecord({ id: 'memory-1', value: 'one' }), score: 9, reasons: ['repo-match'] },
      { record: createMemoryRecord({ id: 'memory-2', value: 'two' }), score: 7, reasons: ['tag-overlap'] },
      { record: createMemoryRecord({ id: 'memory-3', value: 'three' }), score: 5, reasons: ['recent'] }
    ];

    const rankedArtifacts: ScoredRetrieval<ArtifactRecord>[] = [
      { record: createArtifactRecord({ id: 'artifact-1' }), score: 11, reasons: ['repo-match'] },
      { record: createArtifactRecord({ id: 'artifact-2' }), score: 8, reasons: ['recent'] }
    ];

    const inspection = inspectRetrieval({
      rankedMemories,
      rankedArtifacts,
      maxMemories: 2,
      maxArtifacts: 1
    });

    expect(inspection.selectedMemories.map((entry) => entry.record.id)).toEqual(['memory-1', 'memory-2']);
    expect(inspection.selectedArtifacts.map((entry) => entry.record.id)).toEqual(['artifact-1']);
  });
});
