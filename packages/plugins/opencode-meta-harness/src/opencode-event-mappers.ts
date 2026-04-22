import type {
  HostCompactionInput,
  HostRetrievalInspectionInput,
  HostTaskEndInput,
  HostTaskStartInput
} from '@meta-harness/plugin-core'

import type {
  OpenCodeCompactionPayload,
  OpenCodeInspectRetrievalPayload,
  OpenCodeTaskEndPayload,
  OpenCodeTaskStartPayload
} from './opencode-hook-payload'

export function mapOpenCodeTaskStartPayload(input: OpenCodeTaskStartPayload): HostTaskStartInput {
  return {
    repoId: input.repoId,
    taskId: input.taskId,
    taskText: input.taskText,
    taskType: input.taskType,
    policyInput: input.policyInput
  }
}

export function mapOpenCodeTaskEndPayload(input: OpenCodeTaskEndPayload): HostTaskEndInput {
  return {
    ...mapOpenCodeTaskStartPayload(input),
    promptSummary: input.promptSummary,
    suggestedRoute: input.suggestedRoute
  }
}

export function mapOpenCodeInspectRetrievalPayload(input: OpenCodeInspectRetrievalPayload): HostRetrievalInspectionInput {
  return mapOpenCodeTaskStartPayload(input)
}

export function mapOpenCodeCompactionPayload(input: OpenCodeCompactionPayload): HostCompactionInput {
  return {
    repoId: input.repoId,
    taskId: input.taskId,
    taskText: input.taskText,
    suggestedRoute: input.suggestedRoute,
    policyInput: input.policyInput
  }
}
