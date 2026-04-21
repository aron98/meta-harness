import { describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, EvaluatePacketBenchmark, EvaluatePacketBenchmarksResult, MemoryRecord } from '@meta-harness/core';

import { renderHelp, run } from '../src/index';
import { runEvaluatePacketCommand } from '../src/evaluate-packet';

const memories: MemoryRecord[] = [
  {
    id: 'memory-retry',
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    value: 'Run pnpm test after implementing the retry helper.',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T11:00:00.000Z'
  }
];

const artifacts: ArtifactRecord[] = [
  {
    id: 'artifact-retry',
    taskType: 'codegen',
    repoId: 'repo-a',
    promptSummary: 'Implement retry helper',
    filesInspected: ['src/retry.ts'],
    filesChanged: ['src/retry.ts'],
    commands: ['pnpm test'],
    diagnostics: [],
    verification: ['pnpm test'],
    outcome: 'success',
    tags: ['implement', 'retry', 'network'],
    createdAt: '2026-04-21T11:30:00.000Z'
  }
];

const benchmarks: EvaluatePacketBenchmark[] = [
  {
    id: 'implement-retry',
    title: 'Implement retry helper',
    prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
    route: 'implement',
    repo: { id: 'repo-a', maturity: 'active' },
    routeHints: ['implement', 'verify'],
    checklistHints: ['Run pnpm test'],
    tags: ['implement', 'retry', 'network']
  }
];

function createEvaluationResult(): EvaluatePacketBenchmarksResult {
  return {
    benchmarks: [
      {
        benchmark: benchmarks[0],
        withRetrieval: {
          packet: {
            id: 'eval-implement-retry-with-retrieval',
            repoId: 'repo-a',
            taskType: 'codegen',
            selectedMemoryIds: ['memory-retry'],
            selectedArtifactIds: ['artifact-retry'],
            suggestedRoute: 'implement',
            verificationChecklist: ['Run the smallest relevant verification command after implementation.', 'Run pnpm test.'],
            rationale: 'Selected records.',
            createdAt: '2026-04-21T12:00:00.000Z'
          },
          metrics: {
            packetCompleteness: 1,
            routeHitRate: 1,
            expectedTagHitRate: 1,
            verificationChecklistCoverage: 1,
            selectedRecordCount: 2,
            selectedCommandCount: 1
          }
        },
        withoutRetrieval: {
          packet: {
            id: 'eval-implement-retry-without-retrieval',
            repoId: 'repo-a',
            taskType: 'codegen',
            selectedMemoryIds: [],
            selectedArtifactIds: [],
            suggestedRoute: 'implement',
            verificationChecklist: ['Run the smallest relevant verification command after implementation.'],
            rationale: 'Selected records.',
            createdAt: '2026-04-21T12:00:00.000Z'
          },
          metrics: {
            packetCompleteness: 2 / 3,
            routeHitRate: 1,
            expectedTagHitRate: 0,
            verificationChecklistCoverage: 0,
            selectedRecordCount: 0,
            selectedCommandCount: 0
          }
        },
        comparison: {
          packetCompletenessDelta: 1 / 3,
          routeHitRateDelta: 0,
          expectedTagHitRateDelta: 1,
          verificationChecklistCoverageDelta: 1,
          selectedRecordCountDelta: 2,
          selectedCommandCountDelta: 1
        }
      }
    ],
    summary: {
      benchmarkCount: 1,
      retrievalOn: {
        packetCompleteness: 1,
        routeHitRate: 1,
        expectedTagHitRate: 1,
        verificationChecklistCoverage: 1,
        selectedRecordCount: 2,
        selectedCommandCount: 1
      },
      retrievalOff: {
        packetCompleteness: 2 / 3,
        routeHitRate: 1,
        expectedTagHitRate: 0,
        verificationChecklistCoverage: 0,
        selectedRecordCount: 0,
        selectedCommandCount: 0
      },
      comparison: {
        packetCompletenessDelta: 1 / 3,
        routeHitRateDelta: 0,
        expectedTagHitRateDelta: 1,
        verificationChecklistCoverageDelta: 1,
        selectedRecordCountDelta: 2,
        selectedCommandCountDelta: 1
      }
    }
  };
}

describe('runEvaluatePacketCommand', () => {
  it('evaluates stored history against benchmark fixtures and prints structured output', async () => {
    const log = vi.fn();
    const evaluateBenchmarks = vi.fn().mockReturnValue(createEvaluationResult());
    const listMemoryRecords = vi.fn().mockResolvedValue(memories);
    const listArtifactRecords = vi.fn().mockResolvedValue(artifacts);

    const result = await runEvaluatePacketCommand(
      ['--data-root', '/tmp/meta-harness'],
      { log },
      {
        error: vi.fn(),
        benchmarkFixtures: benchmarks,
        evaluateBenchmarks,
        listMemoryRecords,
        listArtifactRecords
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(listMemoryRecords).toHaveBeenCalledWith('/tmp/meta-harness');
    expect(listArtifactRecords).toHaveBeenCalledWith('/tmp/meta-harness');
    expect(evaluateBenchmarks).toHaveBeenCalledWith({
      benchmarks,
      memoryRecords: memories,
      artifactRecords: artifacts,
      referenceTime: expect.any(String)
    });
    expect(JSON.parse(result.output)).toEqual(createEvaluationResult());
    expect(log).toHaveBeenNthCalledWith(1, 'Evaluated 1 benchmark packet(s)');
    expect(log).toHaveBeenNthCalledWith(2, result.output);
  });

  it('returns a failed result when --data-root is missing', async () => {
    const error = vi.fn();

    const result = await runEvaluatePacketCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing input to fail');
    }
    expect(result.error).toBe('error: evaluate-packet failed: missing required --data-root');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('uses the real evaluator and fails when benchmark input is invalid', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const result = await runEvaluatePacketCommand(
      ['--data-root', '/tmp/meta-harness'],
      { log },
      {
        error,
        benchmarkFixtures: [
          {
            id: 'invalid-route-benchmark',
            title: 'Invalid route benchmark',
            prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
            route: 'verify',
            routeHints: ['implement'],
            repo: { id: '', maturity: 'active' },
            checklistHints: ['Run pnpm test'],
            tags: ['api-retry']
          }
        ],
        listMemoryRecords: vi.fn().mockResolvedValue(memories),
        listArtifactRecords: vi.fn().mockResolvedValue(artifacts),
        now: () => '2026-04-21T12:00:00.000Z'
      }
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected invalid benchmark input to fail');
    }
    expect(result.error).toContain('evaluate-packet failed');
    expect(error).toHaveBeenCalledWith(result.error);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Evaluated '));
  });

  it('emits JSON results with --json and preserves warnings in the payload', async () => {
    const log = vi.fn();
    const evaluateBenchmarks = vi.fn().mockReturnValue(createEvaluationResult());

    const result = await runEvaluatePacketCommand(
      ['--data-root', '/tmp/meta-harness', '--json'],
      { log },
      {
        error: vi.fn(),
        benchmarkFixtures: benchmarks,
        evaluateBenchmarks,
        listMemoryRecords: vi.fn().mockResolvedValue({
          records: memories,
          warnings: ['warning: skipped memory record ignored.json']
        }),
        listArtifactRecords: vi.fn().mockResolvedValue({
          records: artifacts,
          warnings: ['warning: skipped artifact record ignored.json']
        })
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      evaluation: createEvaluationResult(),
      warnings: ['warning: skipped memory record ignored.json', 'warning: skipped artifact record ignored.json']
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(result.output);
  });
});

describe('evaluate-packet CLI wiring', () => {
  it('includes evaluate-packet in help output', () => {
    expect(renderHelp()).toContain('evaluate-packet');
  });

  it('dispatches evaluate-packet via the injected command handler', async () => {
    const log = vi.fn();
    const evaluatePacketCommand = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: JSON.stringify(createEvaluationResult())
    });

    const result = await run(['evaluate-packet', '--data-root', '/tmp/store'], { log }, {
      error: vi.fn(),
      evaluatePacket: evaluatePacketCommand
    });

    expect(result).toEqual({
      success: true,
      exitCode: 0,
      output: JSON.stringify(createEvaluationResult())
    });
    expect(evaluatePacketCommand).toHaveBeenCalledWith(['--data-root', '/tmp/store'], { log }, expect.any(Object));
  });
});
