import { describe, expect, it } from 'vitest';

import { createTaskStartContext, type ArtifactRecord, type MemoryRecord } from '@meta-harness/core';

import { createHostSession, type CreateHostSessionInput } from '../../src/index';

type ExpectFalse<T extends false> = T;
type ExpectTrue<T extends true> = T;

type MinimalHostSessionBase = {
  packetId: string;
  repoId: string;
  prompt: string;
  referenceTime: string;
};

export type CreateHostSessionInputTypeAssertions = [
  ExpectFalse<MinimalHostSessionBase extends CreateHostSessionInput ? true : false>,
  ExpectTrue<
    (MinimalHostSessionBase & { memoryRecords: readonly MemoryRecord[]; artifactRecords: readonly ArtifactRecord[] }) extends CreateHostSessionInput ? true : false
  >,
  ExpectTrue<
    (MinimalHostSessionBase & { userMemoryRecords: readonly MemoryRecord[]; userArtifactRecords: readonly ArtifactRecord[] }) extends CreateHostSessionInput ? true : false
  >
];

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

  it('accepts user and project runtime records while preserving legacy record inputs', () => {
    const legacyInput = {
      packetId: 'packet-legacy',
      repoId: 'repo-a',
      prompt: 'Implement retry logic and run tests.',
      taskId: 'task-legacy',
      memoryRecords: [createMemoryRecord({ id: 'legacy-memory', value: 'Legacy memory record for tests' })],
      artifactRecords: [createArtifactRecord({ id: 'legacy-artifact', tags: ['legacy', 'tests'] })],
      maxMemories: 1,
      maxArtifacts: 1,
      referenceTime: '2026-04-21T12:00:00.000Z'
    };
    const projectMemory = createMemoryRecord({ id: 'project-memory', value: 'Project memory mentions retry tests' });
    const userMemory = createMemoryRecord({ id: 'user-memory', value: 'User memory mentions retry tests' });
    const projectArtifact = createArtifactRecord({ id: 'project-artifact', tags: ['retry', 'tests'] });
    const userArtifact = createArtifactRecord({ id: 'user-artifact', tags: ['retry', 'tests'] });

    const twoRootResult = createHostSession({
      packetId: 'packet-two-root',
      repoId: 'repo-a',
      prompt: 'Implement retry logic and run tests.',
      taskId: 'task-two-root',
      runtimeRoots: {
        userDataRoot: '/tmp/meta-harness/user',
        projectDataRoot: '/tmp/meta-harness/project'
      },
      userMemoryRecords: [userMemory],
      projectMemoryRecords: [projectMemory],
      userArtifactRecords: [userArtifact],
      projectArtifactRecords: [projectArtifact],
      maxMemories: 2,
      maxArtifacts: 2,
      referenceTime: '2026-04-21T12:00:00.000Z'
    });

    expect(createHostSession(legacyInput)).toEqual(createTaskStartContext(legacyInput));
    expect(twoRootResult.context.selectedMemories.map((record) => record.id)).toEqual([
      'project-memory',
      'user-memory'
    ]);
    expect(twoRootResult.context.selectedArtifacts.map((record) => record.id)).toEqual([
      'project-artifact',
      'user-artifact'
    ]);
  });

  it('deduplicates user records in favor of project records and reports selected source scopes', () => {
    const result = createHostSession({
      packetId: 'packet-dedupe',
      repoId: 'repo-a',
      prompt: 'Implement retry logic and run tests.',
      taskId: 'task-dedupe',
      runtimeRoots: {
        userDataRoot: '/tmp/meta-harness/user',
        projectDataRoot: '/tmp/meta-harness/project'
      },
      userMemoryRecords: [createMemoryRecord({ id: 'shared-memory', value: 'User memory should lose' })],
      projectMemoryRecords: [createMemoryRecord({ id: 'shared-memory', value: 'Project memory should win' })],
      userArtifactRecords: [createArtifactRecord({ id: 'shared-artifact', promptSummary: 'User artifact should lose' })],
      projectArtifactRecords: [createArtifactRecord({ id: 'shared-artifact', promptSummary: 'Project artifact should win' })],
      maxMemories: 1,
      maxArtifacts: 1,
      referenceTime: '2026-04-21T12:00:00.000Z'
    });

    expect(result.context.selectedMemories).toEqual([
      expect.objectContaining({ id: 'shared-memory', value: 'Project memory should win' })
    ]);
    expect(result.context.selectedArtifacts).toEqual([
      expect.objectContaining({ id: 'shared-artifact', promptSummary: 'Project artifact should win' })
    ]);
    expect(result.adapterMetadata?.selectedMemorySources).toEqual([
      { id: 'shared-memory', sourceScope: 'project' }
    ]);
    expect(result.adapterMetadata?.selectedArtifactSources).toEqual([
      { id: 'shared-artifact', sourceScope: 'project' }
    ]);
  });

  it('passes projected policy context limits and carries policy identity in adapter metadata', () => {
    const result = createHostSession({
      packetId: 'packet-policy',
      repoId: 'repo-a',
      prompt: 'Implement retry logic and run tests.',
      taskId: 'task-policy',
      userMemoryRecords: [
        createMemoryRecord({ id: 'user-memory-1', value: 'User memory one retry tests' }),
        createMemoryRecord({ id: 'user-memory-2', value: 'User memory two retry tests' })
      ],
      projectMemoryRecords: [
        createMemoryRecord({ id: 'project-memory-1', value: 'Project memory one retry tests' })
      ],
      userArtifactRecords: [
        createArtifactRecord({ id: 'user-artifact-1', tags: ['retry', 'tests'] }),
        createArtifactRecord({ id: 'user-artifact-2', tags: ['retry', 'tests'] })
      ],
      projectArtifactRecords: [
        createArtifactRecord({ id: 'project-artifact-1', tags: ['retry', 'tests'] })
      ],
      maxMemories: 1,
      maxArtifacts: 1,
      policyIdentity: {
        runId: 'run-001',
        candidateId: 'candidate-001',
        sourceScope: 'project',
        artifactFile: 'artifacts/runtime-policy.json'
      },
      referenceTime: '2026-04-21T12:00:00.000Z'
    });

    expect(result.context.selectedMemories).toHaveLength(1);
    expect(result.context.selectedArtifacts).toHaveLength(1);
    expect(result.adapterMetadata?.selectedMemorySources).toEqual([
      { id: 'project-memory-1', sourceScope: 'project' }
    ]);
    expect(result.adapterMetadata?.selectedArtifactSources).toEqual([
      { id: 'project-artifact-1', sourceScope: 'project' }
    ]);
    expect(result.adapterMetadata?.policyIdentity).toEqual({
      runId: 'run-001',
      candidateId: 'candidate-001',
      sourceScope: 'project',
      artifactFile: 'artifacts/runtime-policy.json'
    });
  });
});
