import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { loadMemoryRecord, writeMemoryRecord, type MemoryRecord } from '../src/index';

const tempDirectories: string[] = [];

const taskLocalMemory: MemoryRecord = {
  id: 'memory-task-001',
  scope: 'task-local',
  taskId: 'task-123',
  kind: 'summary',
  value: 'Task-local memory belongs under the task id directory.',
  source: 'artifact-analysis',
  sourceArtifactIds: ['artifact-001'],
  confidence: 'high',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:30:00.000Z'
};

const repoLocalMemory: MemoryRecord = {
  id: 'memory-repo-001',
  scope: 'repo-local',
  repoId: 'meta-harness',
  kind: 'fact',
  value: 'Repo-local memory belongs under the repo id directory.',
  source: 'human-input',
  sourceArtifactIds: [],
  confidence: 'medium',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:30:00.000Z'
};

const userGlobalMemory: MemoryRecord = {
  id: 'memory-user-001',
  scope: 'user-global',
  kind: 'preference',
  value: 'User-global memory belongs directly under the scope directory.',
  source: 'session-packet',
  sourceArtifactIds: ['artifact-010'],
  confidence: 'low',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:30:00.000Z'
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('memory store', () => {
  it('stores task-local memory under data/memory/task-local/<task-id>/<id>.json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-memory-'));

    tempDirectories.push(dataRoot);

    const filePath = await writeMemoryRecord(dataRoot, taskLocalMemory);

    expect(filePath).toBe(join(dataRoot, 'data/memory/task-local/task-123/memory-task-001.json'));
    await expect(readFile(filePath, 'utf8')).resolves.toBe(`${JSON.stringify(taskLocalMemory, null, 2)}\n`);
    await expect(loadMemoryRecord(dataRoot, { scope: 'task-local', taskId: 'task-123', id: taskLocalMemory.id })).resolves.toEqual(taskLocalMemory);
  });

  it('stores repo-local memory under data/memory/repo-local/<repo-id>/<id>.json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-memory-'));

    tempDirectories.push(dataRoot);

    const filePath = await writeMemoryRecord(dataRoot, repoLocalMemory);

    expect(filePath).toBe(join(dataRoot, 'data/memory/repo-local/meta-harness/memory-repo-001.json'));
    await expect(readFile(filePath, 'utf8')).resolves.toBe(`${JSON.stringify(repoLocalMemory, null, 2)}\n`);
    await expect(loadMemoryRecord(dataRoot, { scope: 'repo-local', repoId: 'meta-harness', id: repoLocalMemory.id })).resolves.toEqual(repoLocalMemory);
  });

  it('stores user-global memory under data/memory/user-global/<id>.json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-memory-'));

    tempDirectories.push(dataRoot);

    const filePath = await writeMemoryRecord(dataRoot, userGlobalMemory);

    expect(filePath).toBe(join(dataRoot, 'data/memory/user-global/memory-user-001.json'));
    await expect(readFile(filePath, 'utf8')).resolves.toBe(`${JSON.stringify(userGlobalMemory, null, 2)}\n`);
    await expect(loadMemoryRecord(dataRoot, { scope: 'user-global', id: userGlobalMemory.id })).resolves.toEqual(userGlobalMemory);
  });

  it('rejects invalid path segments for memory storage', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-memory-'));

    tempDirectories.push(dataRoot);

    await expect(
      writeMemoryRecord(dataRoot, {
        ...taskLocalMemory,
        taskId: '../outside'
      })
    ).rejects.toThrow(/path segment/i);

    await expect(loadMemoryRecord(dataRoot, { scope: 'user-global', id: '../memory-user-001' })).rejects.toThrow(/path segment/i);
  });

  it('rejects invalid memory records on write', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-memory-'));

    tempDirectories.push(dataRoot);

    await expect(
      writeMemoryRecord(dataRoot, {
        ...repoLocalMemory,
        repoId: undefined
      } as MemoryRecord)
    ).rejects.toThrow(/repoId/i);
  });
});
