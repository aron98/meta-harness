import { join } from 'node:path';

import type { MemoryRecord } from './memory-record';

export type MemoryRecordLocator =
  | { scope: 'task-local'; taskId: string; id: string }
  | { scope: 'repo-local'; repoId: string; id: string }
  | { scope: 'user-global'; id: string };

export function assertValidPathSegment(name: string, value: string): string {
  if (value.trim().length === 0 || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`${name} must be a single path segment`);
  }

  return value;
}

export function getArtifactRecordPath(dataRoot: string, repoId: string, artifactId: string): string {
  return join(
    dataRoot,
    'data',
    'artifacts',
    assertValidPathSegment('repoId', repoId),
    `${assertValidPathSegment('artifactId', artifactId)}.json`
  );
}

export function getMemoryRecordPath(dataRoot: string, record: MemoryRecordLocator | MemoryRecord): string {
  if (record.scope === 'task-local') {
    if (record.taskId === undefined) {
      throw new Error('task-local memory requires taskId');
    }

    return join(
      dataRoot,
      'data',
      'memory',
      'task-local',
      assertValidPathSegment('taskId', record.taskId),
      `${assertValidPathSegment('id', record.id)}.json`
    );
  }

  if (record.scope === 'repo-local') {
    if (record.repoId === undefined) {
      throw new Error('repo-local memory requires repoId');
    }

    return join(
      dataRoot,
      'data',
      'memory',
      'repo-local',
      assertValidPathSegment('repoId', record.repoId),
      `${assertValidPathSegment('id', record.id)}.json`
    );
  }

  return join(dataRoot, 'data', 'memory', 'user-global', `${assertValidPathSegment('id', record.id)}.json`);
}
