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

export type OpenCodeRetrievalLikeToolName = 'read' | 'grep' | 'glob' | 'webfetch'

export type OpenCodeToolExecuteRetrievalSignal = {
  sessionID: string
  callID?: string
  toolName: OpenCodeRetrievalLikeToolName
  arguments: unknown
}

type OpenCodeToolExecuteBeforeInput = {
  sessionID?: string
  callID?: string
  tool?: string
}

type OpenCodeToolExecuteBeforeOutput = {
  args?: unknown
}

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

export function parseOpenCodeToolExecuteRetrievalSignal(
  input: unknown,
  output: unknown
): OpenCodeToolExecuteRetrievalSignal | undefined {
  const record = asRecord(input, 'OpenCode tool.execute payload must be an object.') as OpenCodeToolExecuteBeforeInput
  const result = asRecord(output, 'OpenCode tool.execute output payload must be an object.') as OpenCodeToolExecuteBeforeOutput
  const toolName = asRetrievalLikeToolName(record.tool)

  if (!toolName) {
    return undefined
  }

  return {
    sessionID: asNonEmptyString(record.sessionID, 'sessionID'),
    callID: typeof record.callID === 'string' && record.callID.trim().length > 0 ? record.callID : undefined,
    toolName,
    arguments: result.args
  }
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

function asRetrievalLikeToolName(value: unknown): OpenCodeRetrievalLikeToolName | undefined {
  switch (value) {
    case 'read':
    case 'grep':
    case 'glob':
    case 'webfetch':
      return value
    default:
      return undefined
  }
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`)
  }

  return value
}
