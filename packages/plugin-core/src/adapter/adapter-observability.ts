import { assertValidPathSegment, writeJsonFile } from '@meta-harness/core'
export type AdapterObservabilityOperation = 'task-start' | 'task-end' | 'inspect-retrieval' | 'compact-session'
export type AdapterObservabilityStatus = 'success' | 'failure' | 'warning'

export type AdapterObservabilityRecord = {
  hostId: string
  hookName: string
  operation: AdapterObservabilityOperation
  repoId: string
  taskId: string
  packetId?: string
  selectedMemoryIds: string[]
  selectedArtifactIds: string[]
  policyInputSupplied: boolean
  status: AdapterObservabilityStatus
  warningMessages?: string[]
  createdAt: string
}

const allowedKeys = new Set<keyof AdapterObservabilityRecord>([
  'hostId',
  'hookName',
  'operation',
  'repoId',
  'taskId',
  'packetId',
  'selectedMemoryIds',
  'selectedArtifactIds',
  'policyInputSupplied',
  'status',
  'warningMessages',
  'createdAt'
])

const allowedOperations = new Set<AdapterObservabilityOperation>(['task-start', 'task-end', 'inspect-retrieval', 'compact-session'])
const allowedStatuses = new Set<AdapterObservabilityStatus>(['success', 'failure', 'warning'])

export function parseAdapterObservabilityRecord(input: unknown): AdapterObservabilityRecord {
  const record = asRecord(input, 'Adapter observability record must be an object.')

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key as keyof AdapterObservabilityRecord)) {
      throw new TypeError(`Adapter observability record has an unrecognized key: ${key}`)
    }
  }

  const hostId = asNonEmptyString(record.hostId, 'hostId')
  const hookName = asNonEmptyString(record.hookName, 'hookName')
  const operation = asOperation(record.operation)
  const repoId = asNonEmptyString(record.repoId, 'repoId')
  const taskId = asNonEmptyString(record.taskId, 'taskId')
  const packetId = record.packetId === undefined ? undefined : asNonEmptyString(record.packetId, 'packetId')
  const selectedMemoryIds = asStringArray(record.selectedMemoryIds, 'selectedMemoryIds')
  const selectedArtifactIds = asStringArray(record.selectedArtifactIds, 'selectedArtifactIds')
  const policyInputSupplied = asBoolean(record.policyInputSupplied, 'policyInputSupplied')
  const status = asStatus(record.status)
  const warningMessages = record.warningMessages === undefined ? undefined : asStringArray(record.warningMessages, 'warningMessages')
  const createdAt = asIsoDatetime(record.createdAt, 'createdAt')

  return {
    hostId,
    hookName,
    operation,
    repoId,
    taskId,
    packetId,
    selectedMemoryIds,
    selectedArtifactIds,
    policyInputSupplied,
    status,
    warningMessages,
    createdAt
  }
}

export async function writeAdapterObservabilityRecord(dataRoot: string, input: AdapterObservabilityRecord): Promise<string> {
  const record = parseAdapterObservabilityRecord(input)
  const filePath = `${dataRoot}/data/runtime/adapter-events/${assertValidPathSegment('hostId', record.hostId)}/${assertValidPathSegment('repoId', record.repoId)}/${assertValidPathSegment('taskId', record.taskId)}/${assertValidPathSegment('operation', record.operation)}.json`

  return writeJsonFile(filePath, record)
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

function asStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw new TypeError(`${fieldName} must be an array of non-empty strings`)
  }

  return [...value]
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} must be a boolean`)
  }

  return value
}

function asOperation(value: unknown): AdapterObservabilityOperation {
  if (typeof value !== 'string' || !allowedOperations.has(value as AdapterObservabilityOperation)) {
    throw new TypeError('operation must be one of task-start, task-end, inspect-retrieval, or compact-session')
  }

  return value as AdapterObservabilityOperation
}

function asStatus(value: unknown): AdapterObservabilityStatus {
  if (typeof value !== 'string' || !allowedStatuses.has(value as AdapterObservabilityStatus)) {
    throw new TypeError('status must be one of success, failure, or warning')
  }

  return value as AdapterObservabilityStatus
}

function asIsoDatetime(value: unknown, fieldName: string): string {
  const stringValue = asNonEmptyString(value, fieldName)

  if (Number.isNaN(Date.parse(stringValue))) {
    throw new TypeError(`${fieldName} must be an ISO datetime string`)
  }

  return stringValue
}
