import type { ArtifactRecord } from './artifact-record';
import type { MemoryRecord } from './memory-record';
import { prepareSessionPacket, type PrepareSessionPacketInput } from './prepare-session-packet';
import type { SessionPacket, SessionPacketRoute } from './session-packet';

const metricTokenStopWords = new Set(['a', 'an', 'and', 'after', 'the', 'to', 'with']);

export type EvaluatePacketBenchmark = {
  id: string;
  title: string;
  prompt: string;
  route: SessionPacketRoute;
  repo: {
    id: string;
    maturity: 'new' | 'active' | 'legacy';
  };
  routeHints: readonly SessionPacketRoute[];
  checklistHints: readonly string[];
  tags: readonly string[];
};

export type EvaluatePacketMetrics = {
  packetCompleteness: number;
  routeHitRate: number;
  expectedTagHitRate: number;
  verificationChecklistCoverage: number;
  selectedRecordCount: number;
  selectedCommandCount: number;
};

export type EvaluatePacketBenchmarkResult = {
  benchmark: EvaluatePacketBenchmark;
  withRetrieval: {
    packet: SessionPacket;
    metrics: EvaluatePacketMetrics;
  };
  withoutRetrieval: {
    packet: SessionPacket;
    metrics: EvaluatePacketMetrics;
  };
  comparison: {
    packetCompletenessDelta: number;
    routeHitRateDelta: number;
    expectedTagHitRateDelta: number;
    verificationChecklistCoverageDelta: number;
    selectedRecordCountDelta: number;
    selectedCommandCountDelta: number;
  };
};

export type EvaluatePacketBenchmarksResult = {
  benchmarks: EvaluatePacketBenchmarkResult[];
  summary: {
    benchmarkCount: number;
    retrievalOn: EvaluatePacketMetrics;
    retrievalOff: EvaluatePacketMetrics;
    comparison: EvaluatePacketBenchmarkResult['comparison'];
  };
};

export type EvaluatePacketBenchmarksInput = {
  benchmarks: readonly EvaluatePacketBenchmark[];
  memoryRecords: readonly MemoryRecord[];
  artifactRecords: readonly ArtifactRecord[];
  referenceTime: string;
  maxMemories?: number;
  maxArtifacts?: number;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function toMetricTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !metricTokenStopWords.has(token));
}

function buildPacket(
  benchmark: EvaluatePacketBenchmark,
  input: EvaluatePacketBenchmarksInput,
  packetId: string,
  memoryRecords: readonly MemoryRecord[],
  artifactRecords: readonly ArtifactRecord[]
): SessionPacket {
  const packetInput: PrepareSessionPacketInput = {
    packetId,
    repoId: benchmark.repo.id,
    prompt: benchmark.prompt,
    taskId: benchmark.id,
    routeHints: [...benchmark.routeHints],
    memoryRecords,
    artifactRecords,
    maxMemories: input.maxMemories,
    maxArtifacts: input.maxArtifacts,
    referenceTime: input.referenceTime
  };

  return prepareSessionPacket(packetInput);
}

function getSelectedArtifacts(packet: SessionPacket, artifactRecords: readonly ArtifactRecord[]): ArtifactRecord[] {
  const selectedArtifactIds = new Set(packet.selectedArtifactIds);

  return artifactRecords.filter((record) => selectedArtifactIds.has(record.id));
}

function getSelectedMemories(packet: SessionPacket, memoryRecords: readonly MemoryRecord[]): MemoryRecord[] {
  const selectedMemoryIds = new Set(packet.selectedMemoryIds);

  return memoryRecords.filter((record) => selectedMemoryIds.has(record.id));
}

function calculateChecklistCoverage(checklistHints: readonly string[], checklist: readonly string[]): number {
  if (checklistHints.length === 0) {
    return 1;
  }

  const coveredHintCount = checklistHints.filter((hint) => {
    const hintTokens = toMetricTokens(hint);

    return checklist.some((item) => {
      const itemTokens = new Set(toMetricTokens(item));

      return hintTokens.every((token) => itemTokens.has(token));
    });
  }).length;

  return roundMetric(coveredHintCount / checklistHints.length);
}

function calculateTagHitRate(
  benchmarkTags: readonly string[],
  selectedArtifacts: readonly ArtifactRecord[],
  selectedMemories: readonly MemoryRecord[]
): number {
  if (benchmarkTags.length === 0) {
    return 1;
  }

  const matchedTokens = new Set<string>();

  for (const artifact of selectedArtifacts) {
    for (const token of artifact.tags.flatMap(toMetricTokens)) {
      matchedTokens.add(token);
    }
  }

  for (const memory of selectedMemories) {
    for (const token of toMetricTokens(memory.value)) {
      matchedTokens.add(token);
    }
  }

  const matchedTagCount = benchmarkTags.filter((tag) => {
    const tagTokens = toMetricTokens(tag);

    return tagTokens.every((token) => matchedTokens.has(token));
  }).length;

  return roundMetric(matchedTagCount / benchmarkTags.length);
}

function calculateSelectedCommandCount(selectedArtifacts: readonly ArtifactRecord[]): number {
  return new Set(selectedArtifacts.flatMap((artifact) => [...artifact.commands, ...artifact.verification])).size;
}

function calculateMetrics(
  benchmark: EvaluatePacketBenchmark,
  packet: SessionPacket,
  input: EvaluatePacketBenchmarksInput
): EvaluatePacketMetrics {
  const selectedArtifacts = getSelectedArtifacts(packet, input.artifactRecords);
  const selectedMemories = getSelectedMemories(packet, input.memoryRecords);
  const routeHitRate = benchmark.route === packet.suggestedRoute ? 1 : 0;
  const expectedTagHitRate = calculateTagHitRate(benchmark.tags, selectedArtifacts, selectedMemories);
  const verificationChecklistCoverage = calculateChecklistCoverage(benchmark.checklistHints, packet.verificationChecklist);
  const packetCompleteness = roundMetric((routeHitRate + expectedTagHitRate + verificationChecklistCoverage) / 3);

  return {
    packetCompleteness,
    routeHitRate,
    expectedTagHitRate,
    verificationChecklistCoverage,
    selectedRecordCount: packet.selectedMemoryIds.length + packet.selectedArtifactIds.length,
    selectedCommandCount: calculateSelectedCommandCount(selectedArtifacts)
  };
}

function averageMetrics(metrics: readonly EvaluatePacketMetrics[]): EvaluatePacketMetrics {
  if (metrics.length === 0) {
    return {
      packetCompleteness: 0,
      routeHitRate: 0,
      expectedTagHitRate: 0,
      verificationChecklistCoverage: 0,
      selectedRecordCount: 0,
      selectedCommandCount: 0
    };
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
    {
      packetCompleteness: 0,
      routeHitRate: 0,
      expectedTagHitRate: 0,
      verificationChecklistCoverage: 0,
      selectedRecordCount: 0,
      selectedCommandCount: 0
    }
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

export function evaluatePacketBenchmarks(input: EvaluatePacketBenchmarksInput): EvaluatePacketBenchmarksResult {
  const benchmarks = input.benchmarks.map((benchmark) => {
    const withRetrievalPacket = buildPacket(benchmark, input, `eval-${benchmark.id}-with-retrieval`, input.memoryRecords, input.artifactRecords);
    const withoutRetrievalPacket = buildPacket(benchmark, input, `eval-${benchmark.id}-without-retrieval`, [], []);
    const withRetrievalMetrics = calculateMetrics(benchmark, withRetrievalPacket, input);
    const withoutRetrievalMetrics = calculateMetrics(benchmark, withoutRetrievalPacket, input);

    return {
      benchmark: { ...benchmark },
      withRetrieval: {
        packet: withRetrievalPacket,
        metrics: withRetrievalMetrics
      },
      withoutRetrieval: {
        packet: withoutRetrievalPacket,
        metrics: withoutRetrievalMetrics
      },
      comparison: {
        packetCompletenessDelta: roundMetric(withRetrievalMetrics.packetCompleteness - withoutRetrievalMetrics.packetCompleteness),
        routeHitRateDelta: roundMetric(withRetrievalMetrics.routeHitRate - withoutRetrievalMetrics.routeHitRate),
        expectedTagHitRateDelta: roundMetric(withRetrievalMetrics.expectedTagHitRate - withoutRetrievalMetrics.expectedTagHitRate),
        verificationChecklistCoverageDelta: roundMetric(
          withRetrievalMetrics.verificationChecklistCoverage - withoutRetrievalMetrics.verificationChecklistCoverage
        ),
        selectedRecordCountDelta: withRetrievalMetrics.selectedRecordCount - withoutRetrievalMetrics.selectedRecordCount,
        selectedCommandCountDelta: withRetrievalMetrics.selectedCommandCount - withoutRetrievalMetrics.selectedCommandCount
      }
    };
  });
  const retrievalOn = averageMetrics(benchmarks.map((entry) => entry.withRetrieval.metrics));
  const retrievalOff = averageMetrics(benchmarks.map((entry) => entry.withoutRetrieval.metrics));

  return {
    benchmarks,
    summary: {
      benchmarkCount: benchmarks.length,
      retrievalOn,
      retrievalOff,
      comparison: {
        packetCompletenessDelta: roundMetric(retrievalOn.packetCompleteness - retrievalOff.packetCompleteness),
        routeHitRateDelta: roundMetric(retrievalOn.routeHitRate - retrievalOff.routeHitRate),
        expectedTagHitRateDelta: roundMetric(retrievalOn.expectedTagHitRate - retrievalOff.expectedTagHitRate),
        verificationChecklistCoverageDelta: roundMetric(
          retrievalOn.verificationChecklistCoverage - retrievalOff.verificationChecklistCoverage
        ),
        selectedRecordCountDelta: retrievalOn.selectedRecordCount - retrievalOff.selectedRecordCount,
        selectedCommandCountDelta: retrievalOn.selectedCommandCount - retrievalOff.selectedCommandCount
      }
    }
  };
}
