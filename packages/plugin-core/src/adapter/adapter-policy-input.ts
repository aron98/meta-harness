export type AdapterRetrievalPolicyInput = {
  repoMatchWeight?: number
  recentHalfLifeDays?: number
  taskLocalMemoryBonus?: number
  [key: string]: unknown
}

export type AdapterRoutingPolicyInput = {
  taskTypeOrder?: string[]
  buildPromptMode?: string
  [key: string]: unknown
}

export type AdapterVerificationPolicyInput = {
  includeArtifactVerificationCommands?: boolean
  includeMemoryCommandHints?: boolean
  requirePromptClarificationOnUnclear?: boolean
  [key: string]: unknown
}

export type AdapterPolicyInput = {
  retrieval?: AdapterRetrievalPolicyInput
  routing?: AdapterRoutingPolicyInput
  verification?: AdapterVerificationPolicyInput
}

const allowedTopLevelSections = new Set<keyof AdapterPolicyInput>([
  'retrieval',
  'routing',
  'verification'
])

export function parseAdapterPolicyInput(input: unknown): AdapterPolicyInput {
  const record = asRecord(input, 'Adapter policy input must be an object.')

  for (const key of Object.keys(record)) {
    if (!allowedTopLevelSections.has(key as keyof AdapterPolicyInput)) {
      throw new TypeError(`Adapter policy input has an unrecognized key: ${key}`)
    }
  }

  const parsed: AdapterPolicyInput = {}

  if (record.retrieval !== undefined) {
    parsed.retrieval = asRecord(record.retrieval, 'Adapter policy retrieval section must be an object.')
  }

  if (record.routing !== undefined) {
    parsed.routing = asRecord(record.routing, 'Adapter policy routing section must be an object.')
  }

  if (record.verification !== undefined) {
    parsed.verification = asRecord(record.verification, 'Adapter policy verification section must be an object.')
  }

  return parsed
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(message)
  }

  return { ...value }
}
