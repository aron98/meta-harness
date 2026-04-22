import { describe, expect, it } from 'vitest';

import { createTaskEndArtifact, parseTaskEndEvent } from '@meta-harness/core';

import { createHostArtifact } from '../../src/index';

describe('createHostArtifact', () => {
  it('delegates task-end orchestration to the existing artifact helper and preserves verification state', () => {
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

    const artifact = createHostArtifact(taskEnd);

    expect(artifact).toEqual(createTaskEndArtifact(taskEnd));
    expect(artifact.verification).toEqual(taskEnd.verificationState.checklist);
  });
});
