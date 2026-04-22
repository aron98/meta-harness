import { describe, expect, it } from 'vitest';

import {
  createTaskStartContext,
  parseRuntimeTaskContext,
  parseTaskStartEvent,
  runtimeTaskContextSchema,
  taskStartEventSchema,
  type ArtifactRecord,
  type MemoryRecord,
  type PrepareSessionPacketInput
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

function createInput(overrides: Partial<PrepareSessionPacketInput> = {}): PrepareSessionPacketInput {
  return {
    packetId: 'packet-001',
    repoId: 'repo-a',
    prompt: 'Implement the missing retry logic.',
    taskId: 'task-123',
    memoryRecords: [
      createMemoryRecord({ id: 'memory-1', value: 'Run pnpm test after implementation', updatedAt: '2026-04-21T10:00:00.000Z' }),
      createMemoryRecord({ id: 'memory-2', value: 'Retry logic belongs in packages/core', updatedAt: '2026-04-20T10:00:00.000Z' })
    ],
    artifactRecords: [
      createArtifactRecord({ id: 'artifact-1', taskType: 'codegen', tags: ['implement', 'retry'] }),
      createArtifactRecord({ id: 'artifact-2', taskType: 'verification', tags: ['verify', 'test'], verification: ['pnpm test', 'pnpm build'] })
    ],
    referenceTime: '2026-04-21T12:00:00.000Z',
    ...overrides
  };
}

describe('createTaskStartContext', () => {
  it('builds a compact task-start event and a full runtime context from retrieval results', () => {
    const result = createTaskStartContext({
      ...createInput(),
      unresolvedQuestions: ['Should retry count be configurable?']
    });

    expect(result.taskStart.repoId).toBe('repo-a');
    expect(result.taskStart.taskId).toBe('task-123');
    expect(result.taskStart.taskText).toBe('Implement the missing retry logic.');
    expect(result.taskStart.selectedMemoryIds).toEqual(result.context.packet.selectedMemoryIds);
    expect(result.taskStart.selectedArtifactIds).toEqual(result.context.packet.selectedArtifactIds);
    expect(result.taskStart.suggestedRoute).toBe('implement');
    expect(result.taskStart.verificationState.status).toBe('pending');
    expect(result.taskStart.verificationState.checklist).toEqual(result.context.packet.verificationChecklist);
    expect(result.taskStart.unresolvedQuestions).toEqual(['Should retry count be configurable?']);
    expect(result.context.selectedMemories.map((record) => record.id)).toEqual(result.context.packet.selectedMemoryIds);
    expect(result.context.selectedArtifacts.map((record) => record.id)).toEqual(result.context.packet.selectedArtifactIds);
  });

  it('ignores unsupported checklist overrides and keeps packet verification in sync', () => {
    const result = createTaskStartContext({
      ...createInput(),
      verificationState: {
        status: 'passed',
        checklist: ['Run something unrelated'],
        completedSteps: ['Run pnpm test after implementation.']
      } as unknown as NonNullable<Parameters<typeof createTaskStartContext>[0]['verificationState']> & {
        checklist: string[];
      }
    });

    expect(result.taskStart.verificationState.status).toBe('passed');
    expect(result.taskStart.verificationState.checklist).toEqual(result.context.packet.verificationChecklist);
    expect(result.context.verificationState.checklist).toEqual(result.context.packet.verificationChecklist);
  });
});

describe('task start runtime schemas', () => {
  it('parses task start events and runtime contexts from the package entrypoint', () => {
    const taskStart = parseTaskStartEvent({
      id: 'task-start-001',
      repoId: 'repo-a',
      taskId: 'task-123',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'pending',
        checklist: ['Run pnpm test'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      createdAt: '2026-04-21T12:00:00.000Z',
      startedAt: '2026-04-21T12:00:00.000Z'
    });

    const context = parseRuntimeTaskContext({
      repoId: 'repo-a',
      taskId: 'task-123',
      prompt: 'Implement retry logic',
      packet: {
        id: 'packet-001',
        repoId: 'repo-a',
        taskType: 'codegen',
        taskId: 'task-123',
        selectedMemoryIds: ['memory-1'],
        selectedArtifactIds: ['artifact-1'],
        suggestedRoute: 'implement',
        verificationChecklist: ['Run pnpm test'],
        rationale: 'Selected relevant evidence.',
        createdAt: '2026-04-21T12:00:00.000Z'
      },
      selectedMemories: [createMemoryRecord({ id: 'memory-1', value: 'Run pnpm test' })],
      selectedArtifacts: [createArtifactRecord({ id: 'artifact-1', taskType: 'codegen' })],
      taskStart,
      verificationState: taskStart.verificationState,
      unresolvedQuestions: [],
      createdAt: '2026-04-21T12:00:00.000Z'
    });

    expect(taskStartEventSchema.safeParse(taskStart).success).toBe(true);
    expect(runtimeTaskContextSchema.safeParse(context).success).toBe(true);
  });

  it('rejects contradictory duplicated runtime context fields', () => {
    const result = runtimeTaskContextSchema.safeParse({
      repoId: 'repo-b',
      taskId: 'task-999',
      prompt: 'Implement retry logic',
      packet: {
        id: 'packet-001',
        repoId: 'repo-a',
        taskType: 'codegen',
        taskId: 'task-123',
        selectedMemoryIds: ['memory-1'],
        selectedArtifactIds: ['artifact-1'],
        suggestedRoute: 'implement',
        verificationChecklist: ['Run pnpm test'],
        rationale: 'Selected relevant evidence.',
        createdAt: '2026-04-21T12:00:00.000Z'
      },
      selectedMemories: [createMemoryRecord({ id: 'memory-2', value: 'Run pnpm test', repoId: 'repo-b' })],
      selectedArtifacts: [createArtifactRecord({ id: 'artifact-2', taskType: 'codegen', repoId: 'repo-b' })],
      taskStart: {
        id: 'task-start-001',
        repoId: 'repo-a',
        taskId: 'task-123',
        taskType: 'codegen',
        taskText: 'Implement retry logic',
        selectedMemoryIds: ['memory-1'],
        selectedArtifactIds: ['artifact-1'],
        suggestedRoute: 'implement',
        verificationState: {
          status: 'pending',
          checklist: ['Run pnpm test'],
          completedSteps: []
        },
        unresolvedQuestions: [],
        createdAt: '2026-04-21T12:00:00.000Z',
        startedAt: '2026-04-21T12:00:00.000Z'
      },
      verificationState: {
        status: 'passed',
        checklist: ['Run pnpm build'],
        completedSteps: ['Run pnpm build']
      },
      unresolvedQuestions: ['Question mismatch'],
      createdAt: '2026-04-21T12:00:00.000Z'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.')).join('\n')).toMatch(/repoId|taskId|verificationState|unresolvedQuestions|selectedMemories|selectedArtifacts/);
  });

  it('rejects task-start events where startedAt is before createdAt', () => {
    const result = taskStartEventSchema.safeParse({
      id: 'task-start-001',
      repoId: 'repo-a',
      taskId: 'task-123',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'pending',
        checklist: ['Run pnpm test'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      createdAt: '2026-04-21T12:00:01.000Z',
      startedAt: '2026-04-21T12:00:00.000Z'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['startedAt']);
  });

  it('rejects verification states with completed steps outside the checklist', () => {
    const result = taskStartEventSchema.safeParse({
      id: 'task-start-001',
      repoId: 'repo-a',
      taskId: 'task-123',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'pending',
        checklist: ['Run pnpm test'],
        completedSteps: ['Run pnpm build']
      },
      unresolvedQuestions: [],
      createdAt: '2026-04-21T12:00:00.000Z',
      startedAt: '2026-04-21T12:00:00.000Z'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['verificationState', 'completedSteps', 0]);
  });
});
