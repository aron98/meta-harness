import { describe, expect, it } from 'vitest';

import { createTaskStartContext, type ArtifactRecord, type MemoryRecord } from '@meta-harness/core';

import { createHostSession } from '../../src/index';

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
    taskType: 'analysis',
    repoId: 'repo-a',
    promptSummary: 'Inspect the repository',
    filesInspected: ['README.md'],
    filesChanged: [],
    commands: ['pnpm test'],
    diagnostics: [],
    verification: ['pnpm test'],
    outcome: 'success',
    tags: ['repo', 'inspection'],
    createdAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id
  };
}

describe('createHostSession', () => {
  it('delegates task-start orchestration to the existing core runtime helper', () => {
    const input = {
      packetId: 'packet-001',
      repoId: 'repo-a',
      prompt: 'Implement the missing retry logic.',
      taskId: 'task-123',
      memoryRecords: [
        createMemoryRecord({ id: 'memory-1', value: 'Run pnpm test after implementation' }),
        createMemoryRecord({ id: 'memory-2', value: 'Retry logic belongs in packages/core' })
      ],
      artifactRecords: [
        createArtifactRecord({ id: 'artifact-1', taskType: 'codegen', tags: ['implement', 'retry'] }),
        createArtifactRecord({ id: 'artifact-2', taskType: 'verification', tags: ['verify', 'test'] })
      ],
      unresolvedQuestions: ['Should retry count be configurable?'],
      policyInput: {
        retrieval: {
          repoMatchWeight: 20,
          recentHalfLifeDays: 30
        },
        routing: {
          buildPromptMode: 'prefer-codegen'
        },
        verification: {
          includeArtifactVerificationCommands: true
        }
      },
      referenceTime: '2026-04-21T12:00:00.000Z'
    };

    expect(createHostSession(input)).toEqual(createTaskStartContext(input));
  });
});
