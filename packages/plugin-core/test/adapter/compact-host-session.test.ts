import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCompactionSummary, type CreateCompactionSummaryInput } from '@meta-harness/core';

import { compactHostSession, writeAdapterCompactionRecord } from '../../src/index';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

function createCompactionInput(): CreateCompactionSummaryInput {
  return {
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
}

describe('compactHostSession', () => {
  it('reuses the existing compaction helper for host-neutral session summaries', () => {
    const input = createCompactionInput();

    expect(compactHostSession(input)).toEqual(createCompactionSummary(input));
  });

  it('writes compaction records to project data root when configured', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-user-'));
    const projectDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-project-'));
    tempDirectories.push(userDataRoot, projectDataRoot);
    const summary = compactHostSession(createCompactionInput());
    const input = {
      dataRoot: userDataRoot,
      runtimeRoots: { userDataRoot, projectDataRoot },
      summary
    };

    const filePath = await writeAdapterCompactionRecord(input);

    expect(filePath).toBe(join(projectDataRoot, 'data/runtime/compaction/repo-a/task-123.json'));
  });

  it('writes compaction records to user data root when project data root is absent', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-user-'));
    tempDirectories.push(userDataRoot);
    const summary = compactHostSession(createCompactionInput());
    const input = {
      dataRoot: userDataRoot,
      runtimeRoots: { userDataRoot },
      summary
    };

    const filePath = await writeAdapterCompactionRecord(input);

    expect(filePath).toBe(join(userDataRoot, 'data/runtime/compaction/repo-a/task-123.json'));
  });
});
