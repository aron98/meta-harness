import { describe, expect, it } from 'vitest';

import { parseMemoryRecord, type MemoryRecord } from '../src/index';

const repoLocalMemory: MemoryRecord = {
  id: 'memory-001',
  scope: 'repo-local',
  repoId: 'meta-harness',
  kind: 'fact',
  value: 'Core package uses Zod for schema validation.',
  source: 'artifact-analysis',
  sourceArtifactIds: ['artifact-001'],
  confidence: 'high',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:30:00.000Z',
  expiresAt: '2026-05-01T00:00:00.000Z'
};

describe('parseMemoryRecord', () => {
  it('accepts repo-local memory with a repo id', () => {
    expect(parseMemoryRecord(repoLocalMemory)).toEqual(repoLocalMemory);
  });

  it('requires taskId for task-local memory', () => {
    expect(() =>
      parseMemoryRecord({
        ...repoLocalMemory,
        scope: 'task-local',
        repoId: undefined,
        taskId: undefined
      })
    ).toThrow(/taskId/i);
  });

  it('requires repoId for repo-local memory', () => {
    expect(() =>
      parseMemoryRecord({
        ...repoLocalMemory,
        repoId: undefined
      })
    ).toThrow(/repoId/i);
  });

  it('rejects repoId and taskId for user-global memory', () => {
    expect(() =>
      parseMemoryRecord({
        ...repoLocalMemory,
        scope: 'user-global',
        taskId: 'task-123'
      })
    ).toThrow(/user-global/i);

    expect(() =>
      parseMemoryRecord({
        ...repoLocalMemory,
        scope: 'user-global',
        taskId: undefined
      })
    ).toThrow(/user-global/i);
  });
});
