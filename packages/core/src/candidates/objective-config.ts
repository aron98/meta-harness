import { z } from 'zod';

import type { EvaluatePacketMetrics } from '../evaluate-packet';

const objectiveWeightSchema = z.number().finite().min(0);

export const candidateObjectiveConfigSchema = z
  .object({
    packetCompletenessWeight: objectiveWeightSchema.default(1),
    routeHitRateWeight: objectiveWeightSchema.default(1),
    verificationChecklistCoverageWeight: objectiveWeightSchema.default(1),
    expectedTagHitRateWeight: objectiveWeightSchema.default(0),
    selectedRecordPenalty: objectiveWeightSchema.default(0.01),
    selectedCommandPenalty: objectiveWeightSchema.default(0)
  })
  .strict();

export type CandidateObjectiveConfig = z.infer<typeof candidateObjectiveConfigSchema>;
export type CandidateObjectiveConfigInput = z.input<typeof candidateObjectiveConfigSchema>;

export type CandidateScoreContributions = {
  packetCompleteness: number;
  routeHitRate: number;
  verificationChecklistCoverage: number;
  expectedTagHitRate: number;
  selectedRecordPenalty: number;
  selectedCommandPenalty: number;
};

export type CandidateObjectiveScore = {
  score: number;
  contributions: CandidateScoreContributions;
};

export function parseCandidateObjectiveConfig(input: unknown = {}): CandidateObjectiveConfig {
  return candidateObjectiveConfigSchema.parse(input);
}

function roundScore(value: number): number {
  return Number(value.toFixed(3));
}

export function scoreCandidateObjective(
  summary: { metrics: EvaluatePacketMetrics },
  objectiveConfig: CandidateObjectiveConfigInput = {}
): CandidateObjectiveScore {
  const config = parseCandidateObjectiveConfig(objectiveConfig);
  const contributions: CandidateScoreContributions = {
    packetCompleteness: roundScore(summary.metrics.packetCompleteness * config.packetCompletenessWeight),
    routeHitRate: roundScore(summary.metrics.routeHitRate * config.routeHitRateWeight),
    verificationChecklistCoverage: roundScore(
      summary.metrics.verificationChecklistCoverage * config.verificationChecklistCoverageWeight
    ),
    expectedTagHitRate: roundScore(summary.metrics.expectedTagHitRate * config.expectedTagHitRateWeight),
    selectedRecordPenalty: roundScore(-summary.metrics.selectedRecordCount * config.selectedRecordPenalty),
    selectedCommandPenalty: roundScore(-summary.metrics.selectedCommandCount * config.selectedCommandPenalty)
  };

  return {
    score: roundScore(
      contributions.packetCompleteness +
        contributions.routeHitRate +
        contributions.verificationChecklistCoverage +
        contributions.expectedTagHitRate +
        contributions.selectedRecordPenalty +
        contributions.selectedCommandPenalty
    ),
    contributions
  };
}
