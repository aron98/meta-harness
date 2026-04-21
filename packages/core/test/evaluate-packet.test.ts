import { describe, expect, it } from 'vitest';

import { evaluatePacketBenchmarks, type ArtifactRecord, type EvaluatePacketBenchmark, type MemoryRecord } from '../src/index';

function createMemoryRecord(overrides: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'value'>): MemoryRecord {
  const { id, value, ...rest } = overrides;

  return {
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-10T12:00:00.000Z',
    updatedAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id,
    value
  };
}

function createArtifactRecord(overrides: Partial<ArtifactRecord> & Pick<ArtifactRecord, 'id'>): ArtifactRecord {
  const { id, ...rest } = overrides;

  return {
    taskType: 'codegen',
    repoId: 'repo-a',
    promptSummary: 'Implement the retry helper',
    filesInspected: ['src/retry.ts'],
    filesChanged: ['src/retry.ts'],
    commands: ['pnpm test'],
    diagnostics: [],
    verification: ['pnpm test'],
    outcome: 'success',
    tags: ['implement', 'retry', 'network'],
    createdAt: '2026-04-20T12:00:00.000Z',
    ...rest,
    id
  };
}

describe('evaluatePacketBenchmarks', () => {
  it('compares retrieval-on and retrieval-off packet metrics against benchmark hints', () => {
    const benchmarks: EvaluatePacketBenchmark[] = [
      {
        id: 'implement-retry',
        title: 'Implement retry helper',
        prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
        route: 'implement',
        repo: { id: 'repo-a', maturity: 'active' },
        routeHints: ['implement', 'verify'],
        checklistHints: ['Run pnpm test', 'Run the smallest relevant verification command after implementation'],
        tags: ['implement', 'retry', 'network']
      }
    ];

    const result = evaluatePacketBenchmarks({
      benchmarks,
      memoryRecords: [
        createMemoryRecord({
          id: 'memory-test',
          value: 'Run pnpm test after the retry helper is in place.',
          updatedAt: '2026-04-21T11:00:00.000Z'
        })
      ],
      artifactRecords: [createArtifactRecord({ id: 'artifact-retry' })],
      referenceTime: '2026-04-21T12:00:00.000Z',
      maxMemories: 1,
      maxArtifacts: 1
    });

    expect(result.summary.benchmarkCount).toBe(1);
    expect(result.summary.retrievalOn.selectedRecordCount).toBe(2);
    expect(result.summary.retrievalOff.selectedRecordCount).toBe(0);
    expect(result.summary.retrievalOn.selectedCommandCount).toBe(1);
    expect(result.summary.retrievalOff.selectedCommandCount).toBe(0);

    const evaluation = result.benchmarks[0];

    expect(evaluation?.withRetrieval.packet.selectedMemoryIds).toEqual(['memory-test']);
    expect(evaluation?.withRetrieval.packet.selectedArtifactIds).toEqual(['artifact-retry']);
    expect(evaluation?.withRetrieval.metrics.routeHitRate).toBe(1);
    expect(evaluation?.withRetrieval.metrics.expectedTagHitRate).toBe(1);
    expect(evaluation?.withRetrieval.metrics.verificationChecklistCoverage).toBe(1);
    expect(evaluation?.withoutRetrieval.metrics.verificationChecklistCoverage).toBe(0.5);
    expect(evaluation?.comparison.selectedRecordCountDelta).toBe(2);
    expect(evaluation?.comparison.packetCompletenessDelta).toBeGreaterThan(0);
  });

  it('matches dashed benchmark tags with the same tokenization used for selected content', () => {
    const result = evaluatePacketBenchmarks({
      benchmarks: [
        {
          id: 'implement-api-retry',
          title: 'Implement API retry helper',
          prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
          route: 'implement',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run pnpm test'],
          tags: ['api-retry', 'network-calls']
        }
      ],
      memoryRecords: [
        createMemoryRecord({
          id: 'memory-api-retry',
          value: 'Confirm the API retry logic handles flaky network calls.',
          updatedAt: '2026-04-21T11:00:00.000Z'
        })
      ],
      artifactRecords: [
        createArtifactRecord({
          id: 'artifact-api-retry',
          tags: ['api', 'retry', 'network', 'calls']
        })
      ],
      referenceTime: '2026-04-21T12:00:00.000Z',
      maxMemories: 1,
      maxArtifacts: 1
    });

    expect(result.benchmarks[0]?.withRetrieval.metrics.expectedTagHitRate).toBe(1);
  });

  it('does not give route credit when only a hint matches but the benchmark route differs', () => {
    const result = evaluatePacketBenchmarks({
      benchmarks: [
        {
          id: 'verify-release-build',
          title: 'Verify release build',
          prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
          route: 'verify',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement', 'verify'],
          checklistHints: ['Run pnpm test'],
          tags: ['implement', 'retry', 'network']
        }
      ],
      memoryRecords: [
        createMemoryRecord({
          id: 'memory-test',
          value: 'Run pnpm test after the retry helper is in place.',
          updatedAt: '2026-04-21T11:00:00.000Z'
        })
      ],
      artifactRecords: [createArtifactRecord({ id: 'artifact-retry' })],
      referenceTime: '2026-04-21T12:00:00.000Z',
      maxMemories: 1,
      maxArtifacts: 1
    });

    const evaluation = result.benchmarks[0];

    expect(evaluation?.withRetrieval.packet.suggestedRoute).toBe('implement');
    expect(evaluation?.withRetrieval.metrics.routeHitRate).toBe(0);
  });
});
