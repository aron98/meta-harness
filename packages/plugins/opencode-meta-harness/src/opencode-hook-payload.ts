import type { AdapterPolicyInput } from '@meta-harness/plugin-core'

type OpenCodeBasePayload = {
  repoId: string
  taskId: string
  taskText: string
  policyInput?: AdapterPolicyInput
}

export type OpenCodeTaskStartPayload = OpenCodeBasePayload & {
  taskType: string
}

export type OpenCodeTaskEndPayload = OpenCodeTaskStartPayload & {
  promptSummary: string
  suggestedRoute: string
}

export type OpenCodeInspectRetrievalPayload = OpenCodeTaskStartPayload

export type OpenCodeCompactionPayload = OpenCodeBasePayload & {
  suggestedRoute: string
}

export function parseOpenCodeTaskStartPayload(input: unknown): OpenCodeTaskStartPayload {
  const record = asRecord(input, 'OpenCode task-start payload must be an object.')

  return {
    repoId: asNonEmptyString(record.repoId, 'repoId'),
    taskId: asNonEmptyString(record.taskId, 'taskId'),
    taskText: asNonEmptyString(record.taskText, 'taskText'),
    taskType: asNonEmptyString(record.taskType, 'taskType'),
    policyInput: record.policyInput as AdapterPolicyInput | undefined
  }
}

export function parseOpenCodeTaskEndPayload(input: unknown): OpenCodeTaskEndPayload {
  const record = asRecord(input, 'OpenCode task-end payload must be an object.')

  return {
    ...parseOpenCodeTaskStartPayload(record),
    promptSummary: asNonEmptyString(record.promptSummary, 'promptSummary'),
    suggestedRoute: asNonEmptyString(record.suggestedRoute, 'suggestedRoute')
  }
}

export function parseOpenCodeInspectRetrievalPayload(input: unknown): OpenCodeInspectRetrievalPayload {
  return parseOpenCodeTaskStartPayload(input)
}

export function parseOpenCodeCompactionPayload(input: unknown): OpenCodeCompactionPayload {
  const record = asRecord(input, 'OpenCode compact-session payload must be an object.')

  return {
    repoId: asNonEmptyString(record.repoId, 'repoId'),
    taskId: asNonEmptyString(record.taskId, 'taskId'),
    taskText: asNonEmptyString(record.taskText, 'taskText'),
    suggestedRoute: asNonEmptyString(record.suggestedRoute, 'suggestedRoute'),
    policyInput: record.policyInput as AdapterPolicyInput | undefined
  }
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(message)
  }

  return { ...value }
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`)
  }

  return value
}
