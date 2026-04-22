import type { AdapterObservabilityOperation, AdapterObservabilityRecord, AdapterObservabilityStatus } from '@meta-harness/plugin-core'

export type BuildOpenCodeObservabilityInput = {
  hookName: string
  operation: AdapterObservabilityOperation
  repoId: string
  taskId: string
  packetId?: string
  selectedMemoryIds?: string[]
  selectedArtifactIds?: string[]
  policyInputSupplied: boolean
  status: AdapterObservabilityStatus
  warningMessages?: string[]
  createdAt: string
}

export function buildOpenCodeObservabilityRecord(input: BuildOpenCodeObservabilityInput): AdapterObservabilityRecord {
  return {
    hostId: 'opencode',
    hookName: input.hookName,
    operation: input.operation,
    repoId: input.repoId,
    taskId: input.taskId,
    packetId: input.packetId,
    selectedMemoryIds: input.selectedMemoryIds ?? [],
    selectedArtifactIds: input.selectedArtifactIds ?? [],
    policyInputSupplied: input.policyInputSupplied,
    status: input.status,
    warningMessages: input.warningMessages,
    createdAt: input.createdAt
  }
}
