import { describe, expect, it } from 'vitest';

import {
  rankArtifacts,
  rankMemories,
  type ArtifactRecord,
  type MemoryRecord,
  type RetrievalQuery
} from '../src/index';

const baseQuery: RetrievalQuery = {
  repoId: 'repo-a',
  taskType: 'fix',
  tags: ['build', 'typescript'],
  preferredOutcome: 'success',
  referenceTime: '2026-04-21T12:00:00.000Z'
};

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

describe('retriever', () => {
  it('ranks same-repo memories ahead of different repos', () => {
    const ranked = rankMemories(baseQuery, [
      createMemoryRecord({ id: 'memory-other', repoId: 'repo-b', value: 'Same task, wrong repo', updatedAt: '2026-04-21T11:00:00.000Z' }),
      createMemoryRecord({ id: 'memory-same', value: 'Same repo guidance', updatedAt: '2026-04-20T11:00:00.000Z' })
    ]);

    expect(ranked.map((entry) => entry.record.id)).toEqual(['memory-same', 'memory-other']);
  });

  it('ranks same-task-type artifacts ahead of unrelated task types', () => {
    const ranked = rankArtifacts(baseQuery, [
      createArtifactRecord({ id: 'artifact-analysis', taskType: 'analysis', tags: [] }),
      createArtifactRecord({ id: 'artifact-fix', taskType: 'fix', tags: [] })
    ]);

    expect(ranked.map((entry) => entry.record.id)).toEqual(['artifact-fix', 'artifact-analysis']);
  });

  it('boosts records with overlapping structured tags', () => {
    const ranked = rankArtifacts(baseQuery, [
      createArtifactRecord({ id: 'artifact-no-tags', tags: ['shell'] }),
      createArtifactRecord({ id: 'artifact-tag-match', tags: ['build', 'typescript'] })
    ]);

    expect(ranked.map((entry) => entry.record.id)).toEqual(['artifact-tag-match', 'artifact-no-tags']);
  });

  it('adds recency and explicit outcome relevance bonuses', () => {
    const ranked = rankArtifacts(baseQuery, [
      createArtifactRecord({
        id: 'artifact-old-failure',
        outcome: 'failure',
        failureReason: 'Build still broken',
        tags: ['build', 'failure'],
        createdAt: '2026-03-01T12:00:00.000Z'
      }),
      createArtifactRecord({
        id: 'artifact-recent-success',
        outcome: 'success',
        tags: ['build', 'success'],
        createdAt: '2026-04-21T11:30:00.000Z'
      })
    ]);

    expect(ranked.map((entry) => entry.record.id)).toEqual(['artifact-recent-success', 'artifact-old-failure']);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? Number.NEGATIVE_INFINITY);
  });

  it('uses normalized memory text overlap instead of treating the full value as one tag', () => {
    const ranked = rankMemories(baseQuery, [
      createMemoryRecord({
        id: 'memory-generic',
        value: 'Document the release checklist for operators',
        updatedAt: '2026-04-21T11:00:00.000Z'
      }),
      createMemoryRecord({
        id: 'memory-text-match',
        value: 'Fix the TypeScript build before changing tsconfig defaults',
        updatedAt: '2026-04-21T11:00:00.000Z'
      })
    ]);

    expect(ranked.map((entry) => entry.record.id)).toEqual(['memory-text-match', 'memory-generic']);
    expect(ranked[0]?.reasons).toContain('tag-overlap');
  });

  it('keeps current artifact scores when no policy is supplied and lets candidate weights change ranking', () => {
    const artifacts = [
      createArtifactRecord({ id: 'artifact-repo-match', tags: [], repoId: 'repo-a', taskType: 'analysis' }),
      createArtifactRecord({ id: 'artifact-tag-match', tags: ['build', 'typescript'], repoId: 'repo-b', taskType: 'analysis' })
    ];

    expect(rankArtifacts(baseQuery, artifacts).map((entry) => entry.record.id)).toEqual([
      'artifact-repo-match',
      'artifact-tag-match'
    ]);

    expect(
      rankArtifacts(baseQuery, artifacts, {
        repoMatchWeight: 0,
        tagOverlapWeight: 6
      }).map((entry) => entry.record.id)
    ).toEqual(['artifact-tag-match', 'artifact-repo-match']);
  });

  it('lets candidate task-local memory bonus change memory ranking', () => {
    const memories = [
      createMemoryRecord({ id: 'memory-repo', value: 'Fix TypeScript build summary', scope: 'repo-local' }),
      createMemoryRecord({ id: 'memory-task', value: 'Generic task summary', scope: 'task-local', taskId: 'task-1' })
    ];

    expect(rankMemories(baseQuery, memories).map((entry) => entry.record.id)).toEqual(['memory-repo', 'memory-task']);
    expect(rankMemories(baseQuery, memories, { taskLocalMemoryBonus: 20 }).map((entry) => entry.record.id)).toEqual([
      'memory-task',
      'memory-repo'
    ]);
  });
});
