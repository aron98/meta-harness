import { z } from 'zod';

import {
  candidateBuildPromptModeSchema,
  candidateTaskTypeOrderSchema,
  candidateVerificationPolicySchema,
  candidateRetrievalPolicySchema
} from './candidate';

const mutationBaseSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1)
  })
  .strict();

export const candidateMutationSchema = z.discriminatedUnion('section', [
  mutationBaseSchema.extend({
    section: z.literal('retrieval'),
    field: z.enum([
      'repoMatchWeight',
      'tagOverlapWeight',
      'recentMaxBonus',
      'recentHalfLifeDays',
      'taskTypeWeight',
      'outcomeWeight',
      'taskLocalMemoryBonus'
    ]),
    value: z.union([
      candidateRetrievalPolicySchema.shape.repoMatchWeight,
      candidateRetrievalPolicySchema.shape.recentHalfLifeDays
    ])
  }),
  mutationBaseSchema.extend({
    section: z.literal('routing'),
    field: z.enum(['taskTypeOrder', 'buildPromptMode']),
    value: z.union([candidateTaskTypeOrderSchema, candidateBuildPromptModeSchema])
  }),
  mutationBaseSchema.extend({
    section: z.literal('verification'),
    field: z.enum([
      'includeArtifactVerificationCommands',
      'includeMemoryCommandHints',
      'requirePromptClarificationOnUnclear'
    ]),
    value: z.boolean()
  })
]);

export type CandidateMutation = z.infer<typeof candidateMutationSchema>;

const mutationCatalog = [
  {
    id: 'retrieval-repo-match-weight-high',
    label: 'Increase repository match retrieval weight',
    section: 'retrieval',
    field: 'repoMatchWeight',
    value: 4
  },
  {
    id: 'retrieval-tag-overlap-weight-high',
    label: 'Increase tag overlap retrieval weight',
    section: 'retrieval',
    field: 'tagOverlapWeight',
    value: 3
  },
  {
    id: 'retrieval-recency-half-life-short',
    label: 'Prefer more recent evidence',
    section: 'retrieval',
    field: 'recentHalfLifeDays',
    value: 7
  },
  {
    id: 'retrieval-task-local-memory-high',
    label: 'Increase task-local memory bonus',
    section: 'retrieval',
    field: 'taskLocalMemoryBonus',
    value: 4
  },
  {
    id: 'routing-verification-first',
    label: 'Prefer verification routing for ambiguous tasks',
    section: 'routing',
    field: 'taskTypeOrder',
    value: ['verification', 'fix', 'codegen', 'documentation', 'planning', 'analysis']
  },
  {
    id: 'routing-build-prompt-prefer-verification',
    label: 'Prefer verification-oriented build prompts',
    section: 'routing',
    field: 'buildPromptMode',
    value: 'prefer-verification'
  },
  {
    id: 'routing-build-prompt-prefer-codegen',
    label: 'Prefer code-generation-oriented build prompts',
    section: 'routing',
    field: 'buildPromptMode',
    value: 'prefer-codegen'
  },
  {
    id: 'verification-artifact-commands-off',
    label: 'Omit artifact verification command hints',
    section: 'verification',
    field: 'includeArtifactVerificationCommands',
    value: false
  },
  {
    id: 'verification-memory-hints-off',
    label: 'Omit memory command hints',
    section: 'verification',
    field: 'includeMemoryCommandHints',
    value: false
  }
] satisfies CandidateMutation[];

export function parseCandidateMutation(input: unknown): CandidateMutation {
  const mutation = candidateMutationSchema.parse(input);

  if (mutation.section === 'retrieval') {
    candidateRetrievalPolicySchema.shape[mutation.field].parse(mutation.value);
  }

  if (mutation.section === 'routing') {
    if (mutation.field === 'taskTypeOrder') {
      candidateTaskTypeOrderSchema.parse(mutation.value);
    }

    if (mutation.field === 'buildPromptMode') {
      candidateBuildPromptModeSchema.parse(mutation.value);
    }
  }

  if (mutation.section === 'verification') {
    candidateVerificationPolicySchema.shape[mutation.field].parse(mutation.value);
  }

  return mutation;
}

export function enumerateCandidateMutations(): CandidateMutation[] {
  return mutationCatalog.map((mutation) => parseCandidateMutation(mutation));
}
