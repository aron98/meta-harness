import { z } from 'zod'

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

export type AdapterPolicyContextInput = {
  maxMemories?: number
  maxArtifacts?: number
}

export type AdapterRuntimePolicyArtifact = {
  runId: string
  candidateId: string
  policy: AdapterPolicyInput & { context?: AdapterPolicyContextInput }
}

export type ProjectedRuntimePolicy = {
  policyInput: AdapterPolicyInput
  maxMemories?: number
  maxArtifacts?: number
  identity: {
    runId: string
    candidateId: string
  }
}

const adapterRetrievalPolicyInputSchema = z
  .object({
    repoMatchWeight: z.number().finite().optional(),
    recentHalfLifeDays: z.number().finite().optional(),
    taskLocalMemoryBonus: z.number().finite().optional()
  })
  .catchall(z.unknown())

const adapterRoutingPolicyInputSchema = z
  .object({
    taskTypeOrder: z.array(z.string()).optional(),
    buildPromptMode: z.string().optional()
  })
  .catchall(z.unknown())

const adapterVerificationPolicyInputSchema = z
  .object({
    includeArtifactVerificationCommands: z.boolean().optional(),
    includeMemoryCommandHints: z.boolean().optional(),
    requirePromptClarificationOnUnclear: z.boolean().optional()
  })
  .catchall(z.unknown())

const adapterPolicyInputSchema = z
  .object({
    retrieval: adapterRetrievalPolicyInputSchema.optional(),
    routing: adapterRoutingPolicyInputSchema.optional(),
    verification: adapterVerificationPolicyInputSchema.optional()
  })
  .strict()

const adapterPolicyContextInputSchema = z
  .object({
    maxMemories: z.number().int().min(0).optional(),
    maxArtifacts: z.number().int().min(0).optional()
  })
  .strict()

const adapterRuntimePolicyArtifactSchema = z
  .object({
    runId: z.string().trim().min(1),
    candidateId: z.string().trim().min(1),
    policy: adapterPolicyInputSchema
      .extend({
        context: adapterPolicyContextInputSchema.optional()
      })
      .refine(
        (policy) =>
          policy.retrieval !== undefined ||
          policy.routing !== undefined ||
          policy.verification !== undefined ||
          policy.context !== undefined,
        'Runtime policy artifact policy must include retrieval, routing, verification, or context.'
      )
  })
  .strict()

export function parseAdapterPolicyInput(input: unknown): AdapterPolicyInput {
  return adapterPolicyInputSchema.parse(input)
}

export function parseAdapterRuntimePolicyArtifact(input: unknown): AdapterRuntimePolicyArtifact {
  return adapterRuntimePolicyArtifactSchema.parse(input)
}

export function projectAdapterRuntimePolicyArtifact(input: unknown): ProjectedRuntimePolicy {
  const artifact = parseAdapterRuntimePolicyArtifact(input)
  const policyInput: AdapterPolicyInput = {}

  if (artifact.policy.retrieval !== undefined) {
    policyInput.retrieval = artifact.policy.retrieval
  }

  if (artifact.policy.routing !== undefined) {
    policyInput.routing = artifact.policy.routing
  }

  if (artifact.policy.verification !== undefined) {
    policyInput.verification = artifact.policy.verification
  }

  const projected: ProjectedRuntimePolicy = {
    policyInput,
    identity: {
      runId: artifact.runId,
      candidateId: artifact.candidateId
    }
  }

  if (artifact.policy.context?.maxMemories !== undefined) {
    projected.maxMemories = artifact.policy.context.maxMemories
  }

  if (artifact.policy.context?.maxArtifacts !== undefined) {
    projected.maxArtifacts = artifact.policy.context.maxArtifacts
  }

  return projected
}
