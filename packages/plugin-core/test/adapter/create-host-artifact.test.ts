import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskEndArtifact, parseTaskEndEvent } from '@meta-harness/core';

import { createHostArtifact, writeAdapterTaskEndRecord } from '../../src/index';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

function createTaskEnd() {
  return parseTaskEndEvent({
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
}

describe('createHostArtifact', () => {
  it('delegates task-end orchestration to the existing artifact helper and preserves verification state', () => {
    const taskEnd = createTaskEnd();

    const artifact = createHostArtifact(taskEnd);

    expect(artifact).toEqual(createTaskEndArtifact(taskEnd));
    expect(artifact.verification).toEqual(taskEnd.verificationState.checklist);
  });

  it('writes task-end records to project data root when configured', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-user-'));
    const projectDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-project-'));
    tempDirectories.push(userDataRoot, projectDataRoot);
    const input = {
      dataRoot: userDataRoot,
      runtimeRoots: { userDataRoot, projectDataRoot },
      event: createTaskEnd()
    };

    const filePath = await writeAdapterTaskEndRecord(input);

    expect(filePath).toBe(join(projectDataRoot, 'data/runtime/task-end/repo-a/task-123.json'));
  });

  it('writes task-end records to user data root when project data root is absent', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-user-'));
    tempDirectories.push(userDataRoot);
    const input = {
      dataRoot: userDataRoot,
      runtimeRoots: { userDataRoot },
      event: createTaskEnd()
    };

    const filePath = await writeAdapterTaskEndRecord(input);

    expect(filePath).toBe(join(userDataRoot, 'data/runtime/task-end/repo-a/task-123.json'));
  });
});
