import { join } from 'node:path'

import {
  assertValidPathSegment,
  type CompactionSummary,
  type RuntimeTaskContext,
  type TaskEndEvent,
  writeJsonFile
} from '@meta-harness/core'

export type AdapterTaskStartStorageInput = {
  dataRoot: string
  context: RuntimeTaskContext
}

export type AdapterTaskEndStorageInput = {
  dataRoot: string
  event: TaskEndEvent
}

export type AdapterCompactionStorageInput = {
  dataRoot: string
  summary: CompactionSummary
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
  return writeJsonFile(getRuntimePath(input.dataRoot, 'task-start', input.context.repoId, input.context.taskId), input.context)
}

export async function writeAdapterTaskEndRecord(input: AdapterTaskEndStorageInput): Promise<string> {
  return writeJsonFile(getRuntimePath(input.dataRoot, 'task-end', input.event.repoId, input.event.taskId), input.event)
}

export async function writeAdapterCompactionRecord(input: AdapterCompactionStorageInput): Promise<string> {
  return writeJsonFile(getRuntimePath(input.dataRoot, 'compaction', input.summary.repoId, input.summary.taskId), input.summary)
}
