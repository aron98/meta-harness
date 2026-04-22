import {
  compactHostSession,
  createHostArtifact,
  createHostSession,
  inspectHostRetrieval,
  type AdapterObservabilityRecord,
  type CompactHostSessionInput,
  type CreateHostArtifactInput,
  type CreateHostSessionInput,
  type InspectHostRetrievalInput,
  writeAdapterCompactionRecord,
  writeAdapterObservabilityRecord,
  writeAdapterTaskEndRecord,
  writeAdapterTaskStartRecord
} from '@meta-harness/plugin-core'
import { writeArtifactRecord, type ArtifactRecord, type TaskEndEvent } from '@meta-harness/core'

import {
  mapOpenCodeCompactionPayload,
  mapOpenCodeInspectRetrievalPayload,
  mapOpenCodeTaskEndPayload,
  mapOpenCodeTaskStartPayload
} from './opencode-event-mappers'
import {
  parseOpenCodeCompactionPayload,
  parseOpenCodeInspectRetrievalPayload,
  parseOpenCodeTaskEndPayload,
  parseOpenCodeTaskStartPayload,
  type OpenCodeCompactionPayload,
  type OpenCodeInspectRetrievalPayload,
  type OpenCodeTaskEndPayload,
  type OpenCodeTaskStartPayload
} from './opencode-hook-payload'
import { buildOpenCodeObservabilityRecord } from './opencode-observability'

export type OpenCodeAdapterMetadata = {
  host: 'opencode'
  kind: 'plugin-adapter'
  packageName: '@meta-harness/opencode-meta-harness'
  pluginCorePackageName: '@meta-harness/plugin-core'
}

export type OpenCodeTaskStartRequest = OpenCodeTaskStartPayload & CreateHostSessionInput
export type OpenCodeTaskEndRequest = OpenCodeTaskEndPayload & CreateHostArtifactInput
export type OpenCodeInspectRetrievalRequest = OpenCodeInspectRetrievalPayload & InspectHostRetrievalInput
export type OpenCodeCompactionRequest = OpenCodeCompactionPayload & CompactHostSessionInput

export type OpenCodeAdapter = {
  metadata: OpenCodeAdapterMetadata
  startTask(input: OpenCodeTaskStartRequest): Promise<{ filePath: string; observabilityFilePath: string; result: ReturnType<typeof createHostSession> }>
  endTask(input: OpenCodeTaskEndRequest): Promise<{ eventFilePath: string; artifactFilePath: string; observabilityFilePath: string; result: ArtifactRecord }>
  inspectRetrieval(input: OpenCodeInspectRetrievalRequest): Promise<{ result: ReturnType<typeof inspectHostRetrieval>; observabilityFilePath: string }>
  compactSession(input: OpenCodeCompactionRequest): Promise<{ filePath: string; observabilityFilePath: string; result: ReturnType<typeof compactHostSession> }>
}

type OpenCodeAdapterDependencies = {
  dataRoot: string
  createSession?: (input: CreateHostSessionInput) => ReturnType<typeof createHostSession>
  createArtifact?: (input: CreateHostArtifactInput) => ReturnType<typeof createHostArtifact>
  inspectRetrievalResult?: (input: InspectHostRetrievalInput) => ReturnType<typeof inspectHostRetrieval>
  compactSessionResult?: (input: CompactHostSessionInput) => ReturnType<typeof compactHostSession>
  writeTaskStart?: typeof writeAdapterTaskStartRecord
  writeTaskEnd?: typeof writeAdapterTaskEndRecord
  writeCompaction?: typeof writeAdapterCompactionRecord
  writeObservability?: (dataRoot: string, input: AdapterObservabilityRecord) => Promise<string>
  writeArtifact?: typeof writeArtifactRecord
}

export function createOpenCodeAdapter(dependencies: OpenCodeAdapterDependencies): OpenCodeAdapter {
  const createSession = dependencies.createSession ?? createHostSession
  const createArtifact = dependencies.createArtifact ?? createHostArtifact
  const inspectRetrievalResult = dependencies.inspectRetrievalResult ?? inspectHostRetrieval
  const compactSessionResult = dependencies.compactSessionResult ?? compactHostSession
  const writeTaskStart = dependencies.writeTaskStart ?? writeAdapterTaskStartRecord
  const writeTaskEnd = dependencies.writeTaskEnd ?? writeAdapterTaskEndRecord
  const writeCompaction = dependencies.writeCompaction ?? writeAdapterCompactionRecord
  const writeObservability = dependencies.writeObservability ?? writeAdapterObservabilityRecord
  const writeArtifact = dependencies.writeArtifact ?? writeArtifactRecord

  return {
    metadata: {
      host: 'opencode',
      kind: 'plugin-adapter',
      packageName: '@meta-harness/opencode-meta-harness',
      pluginCorePackageName: '@meta-harness/plugin-core'
    },
    async startTask(input) {
      const parsed = parseOpenCodeTaskStartPayload(input)
      const mapped = mapOpenCodeTaskStartPayload(parsed)
      const result = createSession(input)
      const filePath = await writeTaskStart({ dataRoot: dependencies.dataRoot, context: result.context })
      const observabilityFilePath = await writeObservability(
        dependencies.dataRoot,
        buildOpenCodeObservabilityRecord({
          hookName: 'task:start',
          operation: 'task-start',
          repoId: mapped.repoId,
          taskId: mapped.taskId,
          packetId: result.context.packet.id,
          selectedMemoryIds: result.context.packet.selectedMemoryIds,
          selectedArtifactIds: result.context.packet.selectedArtifactIds,
          policyInputSupplied: mapped.policyInput !== undefined,
          status: 'success',
          createdAt: result.context.createdAt
        })
      )

      return { filePath, observabilityFilePath, result }
    },
    async endTask(input) {
      const parsed = parseOpenCodeTaskEndPayload(input)
      const mapped = mapOpenCodeTaskEndPayload(parsed)
      const result = createArtifact(input)
      const eventFilePath = await writeTaskEnd({ dataRoot: dependencies.dataRoot, event: input as TaskEndEvent })
      const artifactFilePath = await writeArtifact(dependencies.dataRoot, result)
      const observabilityFilePath = await writeObservability(
        dependencies.dataRoot,
        buildOpenCodeObservabilityRecord({
          hookName: 'task:end',
          operation: 'task-end',
          repoId: mapped.repoId,
          taskId: mapped.taskId,
          selectedMemoryIds: input.selectedMemoryIds,
          selectedArtifactIds: input.selectedArtifactIds,
          policyInputSupplied: mapped.policyInput !== undefined,
          status: 'success',
          createdAt: input.endedAt
        })
      )

      return { eventFilePath, artifactFilePath, observabilityFilePath, result }
    },
    async inspectRetrieval(input) {
      const parsed = parseOpenCodeInspectRetrievalPayload(input)
      const mapped = mapOpenCodeInspectRetrievalPayload(parsed)
      const result = inspectRetrievalResult(input)
      const observabilityFilePath = await writeObservability(
        dependencies.dataRoot,
        buildOpenCodeObservabilityRecord({
          hookName: 'retrieval:inspect',
          operation: 'inspect-retrieval',
          repoId: mapped.repoId,
          taskId: mapped.taskId,
          policyInputSupplied: mapped.policyInput !== undefined,
          status: 'success',
          createdAt: new Date().toISOString(),
          selectedMemoryIds: result.selectedMemories.map((entry) => entry.record.id),
          selectedArtifactIds: result.selectedArtifacts.map((entry) => entry.record.id)
        })
      )

      return { result, observabilityFilePath }
    },
    async compactSession(input) {
      const parsed = parseOpenCodeCompactionPayload(input)
      const mapped = mapOpenCodeCompactionPayload(parsed)
      const result = compactSessionResult(input)
      const filePath = await writeCompaction({ dataRoot: dependencies.dataRoot, summary: result })
      const observabilityFilePath = await writeObservability(
        dependencies.dataRoot,
        buildOpenCodeObservabilityRecord({
          hookName: 'session:compact',
          operation: 'compact-session',
          repoId: mapped.repoId,
          taskId: mapped.taskId,
          selectedMemoryIds: result.selectedMemoryIds,
          selectedArtifactIds: result.selectedArtifactIds,
          policyInputSupplied: mapped.policyInput !== undefined,
          status: 'success',
          createdAt: result.compactedAt
        })
      )

      return { filePath, observabilityFilePath, result }
    }
  }
}
