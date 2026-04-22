import { describe, expect, it } from 'vitest';

import { createCompactionSummary, type CreateCompactionSummaryInput } from '@meta-harness/core';

import { compactHostSession } from '../../src/index';

describe('compactHostSession', () => {
  it('reuses the existing compaction helper for host-neutral session summaries', () => {
    const input: CreateCompactionSummaryInput = {
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
    };

    expect(compactHostSession(input)).toEqual(createCompactionSummary(input));
  });
});
