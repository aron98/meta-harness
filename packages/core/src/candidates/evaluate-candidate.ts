import { z } from 'zod';

import type { ArtifactRecord } from '../artifact-record';
import {
  evaluatePacketBenchmarks,
  type EvaluatePacketBenchmark,
  type EvaluatePacketMetrics
} from '../evaluate-packet';
import { fixtureRouteSchema, repoMaturitySchema } from '../fixture-authoring-schema';
import type { MemoryRecord } from '../memory-record';
import type { SessionPacket, SessionPacketRoute } from '../session-packet';
import { createPrepareSessionPacketPolicyInput } from './candidate-policy';
import { parseCandidate, type Candidate, type CandidatePolicy } from './candidate';
import type { CandidateEvaluationPartition } from './candidate-paths';
import { scoreCandidateObjective, type CandidateObjectiveConfigInput, type CandidateScoreContributions } from './objective-config';

export type CandidateBenchmarkFixture = EvaluatePacketBenchmark & {
  split: 'train' | 'held-out';
};

const nonEmptyStringSchema = z.string().trim().min(1);

export const candidateBenchmarkFixtureSchema = z
  .object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
    route: fixtureRouteSchema,
    split: z.enum(['train', 'held-out']),
    repo: z
      .object({
        id: nonEmptyStringSchema,
        maturity: repoMaturitySchema
      })
      .strict(),
    routeHints: z.array(fixtureRouteSchema),
    checklistHints: z.array(nonEmptyStringSchema),
    tags: z.array(nonEmptyStringSchema)
  })
  .strict();

export function parseCandidateBenchmarkFixtures(input: unknown): CandidateBenchmarkFixture[] {
  return z.array(candidateBenchmarkFixtureSchema).parse(input);
}

export type CandidateFixtureEvaluationTrace = {
  candidateId: string;
  fixtureId: string;
  split: CandidateEvaluationPartition;
  packet: SessionPacket;
  metrics: EvaluatePacketMetrics;
  scoreContributions: CandidateScoreContributions;
  selectedMemoryIds: string[];
  selectedArtifactIds: string[];
  selectedRecordIds: string[];
  selectedCommandCount: number;
  routeDecision: {
    expected: SessionPacketRoute;
    actual: SessionPacketRoute;
    hit: boolean;
  };
  expectedTagHitRate: number;
  effectivePolicy: CandidatePolicy;
};

export type CandidateEvaluationSummary = {
  candidateId: string;
  split: CandidateEvaluationPartition;
  fixtureCount: number;
  metrics: EvaluatePacketMetrics;
  score: number;
  scoreContributions?: CandidateScoreContributions;
};

export type CandidateEvaluationResult = {
  candidateId: string;
  candidate: Candidate;
  split: CandidateEvaluationPartition;
  summary: CandidateEvaluationSummary;
  fixtures: CandidateFixtureEvaluationTrace[];
};

export type EvaluateCandidateInput = {
  candidate: Candidate;
  split: CandidateEvaluationPartition;
  fixtures: readonly CandidateBenchmarkFixture[];
  memoryRecords: readonly MemoryRecord[];
  artifactRecords: readonly ArtifactRecord[];
  referenceTime: string;
  maxMemories?: number;
  maxArtifacts?: number;
  objectiveConfig?: CandidateObjectiveConfigInput;
};

function getEffectivePolicy(candidate: Candidate, input: EvaluateCandidateInput): CandidatePolicy {
  return {
    ...candidate.policy,
    context: {
      maxMemories: candidate.policy.context?.maxMemories ?? input.maxMemories ?? 3,
      maxArtifacts: candidate.policy.context?.maxArtifacts ?? input.maxArtifacts ?? 2
    }
  };
}

const emptyMetrics: EvaluatePacketMetrics = {
  packetCompleteness: 0,
  routeHitRate: 0,
  expectedTagHitRate: 0,
  verificationChecklistCoverage: 0,
  selectedRecordCount: 0,
  selectedCommandCount: 0
};

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function averageMetrics(metrics: readonly EvaluatePacketMetrics[]): EvaluatePacketMetrics {
  if (metrics.length === 0) {
    return { ...emptyMetrics };
  }

  const totals = metrics.reduce(
    (result, metric) => ({
      packetCompleteness: result.packetCompleteness + metric.packetCompleteness,
      routeHitRate: result.routeHitRate + metric.routeHitRate,
      expectedTagHitRate: result.expectedTagHitRate + metric.expectedTagHitRate,
      verificationChecklistCoverage: result.verificationChecklistCoverage + metric.verificationChecklistCoverage,
      selectedRecordCount: result.selectedRecordCount + metric.selectedRecordCount,
      selectedCommandCount: result.selectedCommandCount + metric.selectedCommandCount
    }),
    { ...emptyMetrics }
  );

  return {
    packetCompleteness: roundMetric(totals.packetCompleteness / metrics.length),
    routeHitRate: roundMetric(totals.routeHitRate / metrics.length),
    expectedTagHitRate: roundMetric(totals.expectedTagHitRate / metrics.length),
    verificationChecklistCoverage: roundMetric(totals.verificationChecklistCoverage / metrics.length),
    selectedRecordCount: roundMetric(totals.selectedRecordCount / metrics.length),
    selectedCommandCount: roundMetric(totals.selectedCommandCount / metrics.length)
  };
}

export function evaluateCandidate(input: EvaluateCandidateInput): CandidateEvaluationResult {
  const candidate = parseCandidate(input.candidate);
  const effectivePolicy = getEffectivePolicy(candidate, input);
  const evaluation = evaluatePacketBenchmarks({
    benchmarks: input.fixtures,
    memoryRecords: input.memoryRecords,
    artifactRecords: input.artifactRecords,
    referenceTime: input.referenceTime,
    maxMemories: candidate.policy.context?.maxMemories ?? input.maxMemories,
    maxArtifacts: candidate.policy.context?.maxArtifacts ?? input.maxArtifacts,
    policyInput: createPrepareSessionPacketPolicyInput(candidate)
  });
  const fixtures = evaluation.benchmarks.map((entry) => {
    const packet = {
      ...entry.withRetrieval.packet,
      id: `${candidate.id}-${entry.benchmark.id}-${input.split}`
    };
    const score = scoreCandidateObjective({ metrics: entry.withRetrieval.metrics }, input.objectiveConfig);

    return {
      candidateId: candidate.id,
      fixtureId: entry.benchmark.id,
      split: input.split,
      packet,
      metrics: entry.withRetrieval.metrics,
      scoreContributions: score.contributions,
      selectedMemoryIds: packet.selectedMemoryIds,
      selectedArtifactIds: packet.selectedArtifactIds,
      selectedRecordIds: [...packet.selectedMemoryIds, ...packet.selectedArtifactIds],
      selectedCommandCount: entry.withRetrieval.metrics.selectedCommandCount,
      routeDecision: {
        expected: entry.benchmark.route,
        actual: packet.suggestedRoute,
        hit: entry.benchmark.route === packet.suggestedRoute
      },
      expectedTagHitRate: entry.withRetrieval.metrics.expectedTagHitRate,
      effectivePolicy
    };
  });
  const summaryWithoutScore = {
    candidateId: candidate.id,
    split: input.split,
    fixtureCount: fixtures.length,
    metrics: averageMetrics(fixtures.map((fixture) => fixture.metrics)),
    score: 0
  };
  const objective = scoreCandidateObjective(summaryWithoutScore, input.objectiveConfig);
  const summary: CandidateEvaluationSummary = {
    ...summaryWithoutScore,
    score: objective.score,
    scoreContributions: objective.contributions
  };

  return {
    candidateId: candidate.id,
    candidate,
    split: input.split,
    summary,
    fixtures
  };
}
