import type { AdapterObservabilityOperation, AdapterObservabilityRecord, AdapterObservabilityStatus, AdapterPolicyIdentity } from '@meta-harness/plugin-core'

export type BuildOpenCodeObservabilityInput = {
  hookName: string
  operation: AdapterObservabilityOperation
  repoId: string
  taskId: string
  packetId?: string
  selectedMemoryIds?: string[]
  selectedArtifactIds?: string[]
  policyInputSupplied: boolean
  policyIdentity?: AdapterPolicyIdentity
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
    policyRunId: input.policyIdentity?.runId,
    policyCandidateId: input.policyIdentity?.candidateId,
    policySourceScope: input.policyIdentity?.sourceScope,
    policyArtifactFile: input.policyIdentity?.artifactFile,
    status: input.status,
    warningMessages: input.warningMessages,
    createdAt: input.createdAt
  }
}
