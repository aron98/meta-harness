import { z } from 'zod';

import { parseCandidate, type Candidate } from './candidate';
import { candidateMutationSchema, enumerateCandidateMutations, parseCandidateMutation, type CandidateMutation } from './mutation-catalog';

export const candidateSearchConfigSchema = z
  .object({
    mutations: z.array(candidateMutationSchema).optional(),
    maxCombinationSize: z.number().int().min(1).max(3).default(1),
    maxCandidates: z.number().int().positive().optional(),
    includeDefaultMutations: z.boolean().optional()
  })
  .strict()
  .transform((config) => ({
    ...config,
    mutations: config.mutations?.map(parseCandidateMutation) ?? [],
    includeDefaultMutations: config.includeDefaultMutations ?? config.mutations === undefined
  }));

export type CandidateSearchConfig = z.output<typeof candidateSearchConfigSchema>;
export type CandidateSearchConfigInput = z.input<typeof candidateSearchConfigSchema>;

export type GenerateCandidateSearchCandidatesInput = {
  referenceTime: string;
  searchConfig?: CandidateSearchConfigInput;
};

export function parseCandidateSearchConfig(input: unknown = {}): CandidateSearchConfig {
  return candidateSearchConfigSchema.parse(input);
}

function createBaselineCandidate(referenceTime: string): Candidate {
  return parseCandidate({
    id: 'baseline',
    label: 'Baseline policy',
    createdAt: referenceTime,
    mutationIds: [],
    policy: {
      retrieval: {
        repoMatchWeight: 10,
        tagOverlapWeight: 3,
        recentMaxBonus: 4,
        recentHalfLifeDays: 7,
        taskTypeWeight: 8,
        outcomeWeight: 4,
        taskLocalMemoryBonus: 1
      },
      routing: {
        taskTypeOrder: ['verification', 'planning', 'documentation', 'fix', 'codegen', 'analysis'],
        buildPromptMode: 'default'
      },
      verification: {
        includeArtifactVerificationCommands: true,
        includeMemoryCommandHints: true,
        requirePromptClarificationOnUnclear: true
      }
    }
  });
}

function applyMutation(candidate: Candidate, mutation: CandidateMutation): Candidate {
  return parseCandidate({
    ...candidate,
    policy: {
      ...candidate.policy,
      [mutation.section]: {
        ...candidate.policy[mutation.section],
        [mutation.field]: mutation.value
      }
    }
  });
}

function applyMutationCombination(baseline: Candidate, mutations: readonly CandidateMutation[], referenceTime: string): Candidate {
  const mutated = mutations.reduce((candidate, mutation) => applyMutation(candidate, mutation), baseline);
  const mutationIds = mutations.map((mutation) => mutation.id);
  const isSingle = mutations.length === 1;

  return parseCandidate({
    ...mutated,
    id: isSingle ? mutations[0]?.id : `candidate-${mutationIds.join('__')}`,
    label: mutations.map((mutation) => mutation.label).join(' + '),
    baseCandidateId: baseline.id,
    createdAt: referenceTime,
    mutationIds
  });
}

function collectCombinations(
  mutations: readonly CandidateMutation[],
  size: number,
  startIndex: number,
  current: CandidateMutation[],
  combinations: CandidateMutation[][]
): void {
  if (current.length === size) {
    combinations.push([...current]);
    return;
  }

  for (let index = startIndex; index < mutations.length; index += 1) {
    const mutation = mutations[index];

    if (mutation !== undefined) {
      current.push(mutation);
      collectCombinations(mutations, size, index + 1, current, combinations);
      current.pop();
    }
  }
}

function enumerateMutationCombinations(
  mutations: readonly CandidateMutation[],
  maxCombinationSize: number
): CandidateMutation[][] {
  const combinations: CandidateMutation[][] = [];

  for (let size = 1; size <= maxCombinationSize; size += 1) {
    collectCombinations(mutations, size, 0, [], combinations);
  }

  return combinations;
}

export function generateCandidateSearchCandidates(input: GenerateCandidateSearchCandidatesInput): Candidate[] {
  const config = parseCandidateSearchConfig(input.searchConfig);
  const baseline = createBaselineCandidate(input.referenceTime);
  const catalog = [
    ...(config.includeDefaultMutations ? enumerateCandidateMutations() : []),
    ...config.mutations
  ];
  const candidates = [
    baseline,
    ...enumerateMutationCombinations(catalog, config.maxCombinationSize).map((mutations) =>
      applyMutationCombination(baseline, mutations, input.referenceTime)
    )
  ];

  if (config.maxCandidates !== undefined && candidates.length > config.maxCandidates) {
    throw new Error(
      `candidate search generated ${candidates.length} candidates, which exceeds maxCandidates ${config.maxCandidates}`
    );
  }

  return candidates;
}
