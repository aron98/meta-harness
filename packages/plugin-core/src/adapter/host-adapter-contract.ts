import type { AdapterPolicyInput } from './adapter-policy-input'

export type HostAdapterMetadata = {
  name: string
  version: string
}

type HostOperationInput = {
  repoId: string
  taskId: string
  taskText: string
  policyInput?: AdapterPolicyInput
}

export type HostTaskStartInput = HostOperationInput & {
  taskType: string
}

export type HostTaskEndInput = HostTaskStartInput & {
  promptSummary: string
  suggestedRoute: string
}

export type HostRetrievalInspectionInput = HostTaskStartInput

export type HostCompactionInput = HostOperationInput & {
  suggestedRoute: string
}

export type HostAdapterContract<THost extends HostAdapterMetadata = HostAdapterMetadata> = {
  host: THost
  startTask(input: HostTaskStartInput): void | Promise<void>
  endTask(input: HostTaskEndInput): void | Promise<void>
  inspectRetrieval(input: HostRetrievalInspectionInput): void | Promise<void>
  compactSession(input: HostCompactionInput): void | Promise<void>
}
