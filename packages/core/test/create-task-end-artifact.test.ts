import { describe, expect, it } from 'vitest';

import {
  artifactRecordSchema,
  compactionSummarySchema,
  createTaskEndArtifact,
  parseCompactionSummary,
  parseTaskEndEvent,
  taskEndEventSchema
} from '../src/index';

describe('createTaskEndArtifact', () => {
  it('converts a task-end event into a valid artifact record', () => {
    const taskEnd = parseTaskEndEvent({
      id: 'task-end-001',
      repoId: 'repo-a',
      taskId: 'task-123',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      promptSummary: 'Implement retry logic in packages/core',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test', 'pnpm build'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: ['Should retry count be configurable?'],
      filesInspected: ['packages/core/src/index.ts'],
      filesChanged: ['packages/core/src/create-task-end-artifact.ts'],
      commands: ['pnpm --filter @meta-harness/core test'],
      diagnostics: ['targeted tests passed'],
      outcome: 'success',
      tags: ['phase-2', 'runtime-core'],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z'
    });

    const artifact = createTaskEndArtifact(taskEnd);

    expect(artifactRecordSchema.safeParse(artifact).success).toBe(true);
    expect(artifact.id).toBe('task-end-001');
    expect(artifact.repoId).toBe('repo-a');
    expect(artifact.taskId).toBe('task-123');
    expect(artifact.promptSummary).toBe('Implement retry logic in packages/core');
    expect(artifact.verification).toEqual(['pnpm test', 'pnpm build']);
    expect(artifact.diagnostics).toContain('Unresolved questions: Should retry count be configurable?');
    expect(artifact.createdAt).toBe('2026-04-21T12:10:00.000Z');
  });
});

describe('task end schemas', () => {
  it('parses task end events and compaction summaries from the package entrypoint', () => {
    const summary = parseCompactionSummary({
      repoId: 'repo-a',
      taskId: 'task-123',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: [],
      compactedAt: '2026-04-21T12:15:00.000Z',
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z'
    });

    expect(taskEndEventSchema.safeParse({
      id: 'task-end-001',
      repoId: 'repo-a',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      promptSummary: 'Implement retry logic in packages/core',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'pending',
        checklist: ['pnpm test'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      filesInspected: [],
      filesChanged: [],
      commands: [],
      diagnostics: [],
      outcome: 'partial',
      tags: [],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z'
    }).success).toBe(true);
    expect(compactionSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('rejects failure task-end events without a failure reason', () => {
    const result = taskEndEventSchema.safeParse({
      id: 'task-end-001',
      repoId: 'repo-a',
      taskType: 'fix',
      taskText: 'Fix retry logic',
      promptSummary: 'Fix retry logic in packages/core',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'failed',
        checklist: ['pnpm test'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      filesInspected: [],
      filesChanged: [],
      commands: [],
      diagnostics: [],
      outcome: 'failure',
      tags: [],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['failureReason']);
  });

  it('rejects task-end events with invalid time ordering', () => {
    const result = taskEndEventSchema.safeParse({
      id: 'task-end-001',
      repoId: 'repo-a',
      taskType: 'codegen',
      taskText: 'Implement retry logic',
      promptSummary: 'Implement retry logic in packages/core',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'pending',
        checklist: ['pnpm test'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      filesInspected: [],
      filesChanged: [],
      commands: [],
      diagnostics: [],
      outcome: 'partial',
      tags: [],
      startedAt: '2026-04-21T12:10:00.000Z',
      endedAt: '2026-04-21T12:00:00.000Z'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endedAt']);
  });

  it('rejects compaction summaries with invalid time ordering', () => {
    const endedBeforeStart = compactionSummarySchema.safeParse({
      repoId: 'repo-a',
      taskId: 'task-123',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: [],
      compactedAt: '2026-04-21T12:15:00.000Z',
      startedAt: '2026-04-21T12:10:00.000Z',
      endedAt: '2026-04-21T12:00:00.000Z'
    });

    const compactedBeforeEnd = compactionSummarySchema.safeParse({
      repoId: 'repo-a',
      taskId: 'task-123',
      taskText: 'Implement retry logic',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: [],
      compactedAt: '2026-04-21T12:05:00.000Z',
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z'
    });

    expect(endedBeforeStart.success).toBe(false);
    expect(endedBeforeStart.error?.issues[0]?.path).toEqual(['endedAt']);
    expect(compactedBeforeEnd.success).toBe(false);
    expect(compactedBeforeEnd.error?.issues[0]?.path).toEqual(['compactedAt']);
  });
});
