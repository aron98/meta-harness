import { join } from 'node:path'

import {
  assertValidPathSegment,
  type CompactionSummary,
  type RuntimeTaskContext,
  type TaskEndEvent,
  writeJsonFile
} from '@meta-harness/core'

import type { AdapterRuntimeRoots } from './host-adapter-contract'

export type AdapterTaskStartStorageInput = {
  dataRoot: string
  runtimeRoots?: AdapterRuntimeRoots
  context: RuntimeTaskContext
}

export type AdapterTaskEndStorageInput = {
  dataRoot: string
  runtimeRoots?: AdapterRuntimeRoots
  event: TaskEndEvent
}

export type AdapterCompactionStorageInput = {
  dataRoot: string
  runtimeRoots?: AdapterRuntimeRoots
  summary: CompactionSummary
}

export function getRuntimeWriteRoot(roots: AdapterRuntimeRoots): string {
  return roots.projectDataRoot ?? roots.userDataRoot
}

function selectRuntimeDataRoot(input: { dataRoot: string; runtimeRoots?: AdapterRuntimeRoots }): string {
  return input.runtimeRoots === undefined ? input.dataRoot : getRuntimeWriteRoot(input.runtimeRoots)
}

function getRuntimePath(dataRoot: string, category: 'task-start' | 'task-end' | 'compaction', repoId: string, taskId: string | undefined): string {
  if (taskId === undefined) {
    throw new Error(`${category} requires taskId for runtime storage`)
  }

  return join(
    dataRoot,
    'data',
    'runtime',
    category,
    assertValidPathSegment('repoId', repoId),
    `${assertValidPathSegment('taskId', taskId)}.json`
  )
}

export async function writeAdapterTaskStartRecord(input: AdapterTaskStartStorageInput): Promise<string> {
  return writeJsonFile(getRuntimePath(selectRuntimeDataRoot(input), 'task-start', input.context.repoId, input.context.taskId), input.context)
}

export async function writeAdapterTaskEndRecord(input: AdapterTaskEndStorageInput): Promise<string> {
  return writeJsonFile(getRuntimePath(selectRuntimeDataRoot(input), 'task-end', input.event.repoId, input.event.taskId), input.event)
}

export async function writeAdapterCompactionRecord(input: AdapterCompactionStorageInput): Promise<string> {
  return writeJsonFile(getRuntimePath(selectRuntimeDataRoot(input), 'compaction', input.summary.repoId, input.summary.taskId), input.summary)
}
