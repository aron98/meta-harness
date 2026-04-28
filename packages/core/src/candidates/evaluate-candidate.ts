import type { ArtifactRecord } from '../artifact-record';
import {
  evaluatePacketBenchmarks,
  type EvaluatePacketBenchmark,
  type EvaluatePacketMetrics
} from '../evaluate-packet';
import type { MemoryRecord } from '../memory-record';
import type { SessionPacket } from '../session-packet';
import { createPrepareSessionPacketPolicyInput } from './candidate-policy';
import { parseCandidate, type Candidate } from './candidate';
import type { CandidateEvaluationPartition } from './candidate-paths';
import { scoreCandidateSummary } from './search-objective';

export type CandidateBenchmarkFixture = EvaluatePacketBenchmark & {
  split: 'train' | 'held-out';
};

export type CandidateFixtureEvaluationTrace = {
  candidateId: string;
  fixtureId: string;
  split: CandidateEvaluationPartition;
  packet: SessionPacket;
  metrics: EvaluatePacketMetrics;
};

export type CandidateEvaluationSummary = {
  candidateId: string;
  split: CandidateEvaluationPartition;
  fixtureCount: number;
  metrics: EvaluatePacketMetrics;
  score: number;
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
};

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
  const evaluation = evaluatePacketBenchmarks({
    benchmarks: input.fixtures,
    memoryRecords: input.memoryRecords,
    artifactRecords: input.artifactRecords,
    referenceTime: input.referenceTime,
    maxMemories: input.maxMemories,
    maxArtifacts: input.maxArtifacts,
    policyInput: createPrepareSessionPacketPolicyInput(candidate)
  });
  const fixtures = evaluation.benchmarks.map((entry) => ({
    candidateId: candidate.id,
    fixtureId: entry.benchmark.id,
    split: input.split,
    packet: {
      ...entry.withRetrieval.packet,
      id: `${candidate.id}-${entry.benchmark.id}-${input.split}`
    },
    metrics: entry.withRetrieval.metrics
  }));
  const summary: CandidateEvaluationSummary = {
    candidateId: candidate.id,
    split: input.split,
    fixtureCount: fixtures.length,
    metrics: averageMetrics(fixtures.map((fixture) => fixture.metrics)),
    score: 0
  };

  return {
    candidateId: candidate.id,
    candidate,
    split: input.split,
    summary: {
      ...summary,
      score: scoreCandidateSummary(summary)
    },
    fixtures
  };
}
