import { describe, expect, it } from 'vitest';

import { compactionSummarySchema, createCompactionSummary } from '../src/index';

describe('createCompactionSummary', () => {
  it('preserves route, evidence ids, verification state, and unresolved questions', () => {
    const summary = createCompactionSummary({
      repoId: 'repo-a',
      taskId: 'task-123',
      taskText: 'Implement retrieval inspection helpers for compaction',
      selectedMemoryIds: ['memory-1', 'memory-2'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'implement',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test', 'pnpm build'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: ['Should summaries keep repo-local evidence only?'],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z',
      compactedAt: '2026-04-21T12:15:00.000Z'
    });

    expect(summary.suggestedRoute).toBe('implement');
    expect(summary.selectedMemoryIds).toEqual(['memory-1', 'memory-2']);
    expect(summary.selectedArtifactIds).toEqual(['artifact-1']);
    expect(summary.verificationState).toEqual({
      status: 'passed',
      checklist: ['pnpm test', 'pnpm build'],
      completedSteps: ['pnpm test']
    });
    expect(summary.unresolvedQuestions).toEqual(['Should summaries keep repo-local evidence only?']);
    expect(compactionSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('returns bounded structured output instead of passing through arbitrary-length fields', () => {
    const summary = createCompactionSummary({
      repoId: 'repo-a',
      taskText: 'x'.repeat(400),
      selectedMemoryIds: ['memory-1', 'memory-2', 'memory-3', 'memory-4'],
      selectedArtifactIds: ['artifact-1', 'artifact-2', 'artifact-3'],
      suggestedRoute: 'verify',
      verificationState: {
        status: 'failed',
        checklist: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7'],
        completedSteps: ['step-2', 'step-6', 'step-7']
      },
      unresolvedQuestions: ['q1', 'q2', 'q3', 'q4', 'q5'],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z',
      compactedAt: '2026-04-21T12:15:00.000Z'
    });

    expect(summary.taskText.length).toBe(280);
    expect(summary.selectedMemoryIds).toEqual(['memory-1', 'memory-2', 'memory-3']);
    expect(summary.selectedArtifactIds).toEqual(['artifact-1', 'artifact-2']);
    expect(summary.verificationState.checklist).toEqual(['step-1', 'step-2', 'step-3', 'step-4', 'step-5']);
    expect(summary.verificationState.completedSteps).toEqual(['step-2']);
    expect(summary.unresolvedQuestions).toEqual(['q1', 'q2', 'q3']);
  });

  it('normalizes task text before truncating whitespace-padded boundary values', () => {
    const summary = createCompactionSummary({
      repoId: 'repo-a',
      taskText: `${' '.repeat(280)}x`,
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'verify',
      verificationState: {
        status: 'passed',
        checklist: ['pnpm test'],
        completedSteps: ['pnpm test']
      },
      unresolvedQuestions: [],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:10:00.000Z',
      compactedAt: '2026-04-21T12:15:00.000Z'
    });

    expect(summary.taskText).toBe('x');
  });
});
