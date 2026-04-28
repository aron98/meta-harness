import { z } from 'zod';

import { taskTypeSchema } from '../artifact-record';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });
const retrievalWeightSchema = z.number().finite().min(0).max(20);

export const candidateRetrievalPolicySchema = z
  .object({
    repoMatchWeight: retrievalWeightSchema,
    tagOverlapWeight: retrievalWeightSchema,
    recentMaxBonus: retrievalWeightSchema,
    recentHalfLifeDays: z.number().finite().min(1).max(60),
    taskTypeWeight: retrievalWeightSchema,
    outcomeWeight: retrievalWeightSchema,
    taskLocalMemoryBonus: retrievalWeightSchema
  })
  .strict();

export const candidateBuildPromptModeSchema = z.enum(['default', 'prefer-verification', 'prefer-codegen']);
export const candidateTaskTypeOrderSchema = z.array(taskTypeSchema).min(1);

export const candidateRoutingPolicySchema = z
  .object({
    taskTypeOrder: candidateTaskTypeOrderSchema,
    buildPromptMode: candidateBuildPromptModeSchema
  })
  .strict()
  .superRefine((value, ctx) => {
    const uniqueTaskTypes = new Set(value.taskTypeOrder);

    if (uniqueTaskTypes.size !== value.taskTypeOrder.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'taskTypeOrder must not contain duplicates',
        path: ['taskTypeOrder']
      });
    }
  });

export const candidateVerificationPolicySchema = z
  .object({
    includeArtifactVerificationCommands: z.boolean(),
    includeMemoryCommandHints: z.boolean(),
    requirePromptClarificationOnUnclear: z.boolean()
  })
  .strict();

export const candidatePolicySchema = z
  .object({
    retrieval: candidateRetrievalPolicySchema,
    routing: candidateRoutingPolicySchema,
    verification: candidateVerificationPolicySchema
  })
  .strict();

export const candidateSchema = z
  .object({
    id: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    baseCandidateId: nonEmptyStringSchema.optional(),
    createdAt: isoDatetimeSchema,
    mutationIds: z.array(nonEmptyStringSchema),
    policy: candidatePolicySchema
  })
  .strict();

export type CandidateRetrievalPolicy = z.infer<typeof candidateRetrievalPolicySchema>;
export type CandidateBuildPromptMode = z.infer<typeof candidateBuildPromptModeSchema>;
export type CandidateRoutingPolicy = z.infer<typeof candidateRoutingPolicySchema>;
export type CandidateVerificationPolicy = z.infer<typeof candidateVerificationPolicySchema>;
export type CandidatePolicy = z.infer<typeof candidatePolicySchema>;
export type Candidate = z.infer<typeof candidateSchema>;

export function parseCandidate(input: unknown): Candidate {
  return candidateSchema.parse(input);
}
