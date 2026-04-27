import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ArtifactRecord,
  Candidate,
  CandidateBenchmarkFixture,
  CandidateEvaluationResult,
  CandidateSearchResult,
  MemoryRecord
} from '@meta-harness/core';

import { renderHelp, run } from '../src/index';
import { runCandidateSearchCommand } from '../src/run-candidate-search';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

const candidate: Candidate = {
  id: 'baseline',
  label: 'Baseline policy',
  createdAt: '2026-04-26T12:00:00.000Z',
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
};

const fixtures: CandidateBenchmarkFixture[] = [
  {
    id: 'train-implement',
    title: 'Implement retry helper',
    prompt: 'Implement a retry helper.',
    route: 'implement',
    split: 'train',
    repo: { id: 'repo-a', maturity: 'active' },
    routeHints: ['implement'],
    checklistHints: ['Run pnpm test'],
    tags: ['implement']
  },
  {
    id: 'held-out-plan',
    title: 'Plan migration',
    prompt: 'Plan the migration.',
    route: 'plan',
    split: 'held-out',
    repo: { id: 'repo-a', maturity: 'legacy' },
    routeHints: ['plan'],
    checklistHints: ['Identify dependencies'],
    tags: ['plan']
  }
];

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
  },
  {
    id: 'memory-plan',
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    value: 'Planning tasks should list dependencies first.',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'medium',
    createdAt: '2026-04-21T12:00:00.000Z',
    updatedAt: '2026-04-21T12:30:00.000Z'
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
    tags: ['implement', 'retry'],
    createdAt: '2026-04-21T11:30:00.000Z'
  }
];

function evaluationResult(split: 'search' | 'held-out', score: number): CandidateEvaluationResult {
  return {
    candidateId: candidate.id,
    candidate,
    split,
    summary: {
      candidateId: candidate.id,
      split,
      fixtureCount: 1,
      metrics: {
        packetCompleteness: 1,
        routeHitRate: 1,
        expectedTagHitRate: 1,
        verificationChecklistCoverage: 1,
        selectedRecordCount: 1,
        selectedCommandCount: 1
      },
      score
    },
    fixtures: []
  };
}

function searchResult(): CandidateSearchResult {
  const winner = evaluationResult('search', 0.95);

  return {
    runId: 'candidate-smoke',
    trainFixtureCount: 1,
    heldOutFixtureCount: 1,
    candidates: [winner],
    winner
  };
}

describe('runCandidateSearchCommand', () => {
  it('runs search and held-out validation from local stores and prints a human summary', async () => {
    const log = vi.fn();
    const runSearch = vi.fn().mockResolvedValue(searchResult());
    const validateHeldOut = vi.fn().mockResolvedValue(evaluationResult('held-out', 0.9));
    const listMemoryRecords = vi.fn().mockResolvedValue({ records: memories, warnings: ['warning: skipped memory record ignored.json'] });
    const listArtifactRecords = vi.fn().mockResolvedValue(artifacts);

    const result = await runCandidateSearchCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--input',
        JSON.stringify({
          runId: 'candidate-smoke',
          referenceTime: '2026-04-26T12:00:00.000Z',
          maxMemories: 1,
          maxArtifacts: 1
        })
      ],
      { log },
      {
        error: vi.fn(),
        benchmarkFixtures: fixtures,
        listMemoryRecords,
        listArtifactRecords,
        runSearch,
        validateHeldOut
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(listMemoryRecords).toHaveBeenCalledWith('/tmp/meta-harness');
    expect(listArtifactRecords).toHaveBeenCalledWith('/tmp/meta-harness');
    expect(runSearch).toHaveBeenCalledWith({
      dataRoot: '/tmp/meta-harness',
      runId: 'candidate-smoke',
      fixtures,
      memoryRecords: memories,
      artifactRecords: artifacts,
      referenceTime: '2026-04-26T12:00:00.000Z',
      maxMemories: 1,
      maxArtifacts: 1
    });
    expect(validateHeldOut).toHaveBeenCalledWith({
      dataRoot: '/tmp/meta-harness',
      runId: 'candidate-smoke',
      candidate,
      fixtures,
      memoryRecords: memories,
      artifactRecords: artifacts,
      referenceTime: '2026-04-26T12:00:00.000Z',
      maxMemories: 1,
      maxArtifacts: 1,
      selection: searchResult().winner
    });
    expect(log).toHaveBeenNthCalledWith(1, 'warning: skipped memory record ignored.json');
    expect(log).toHaveBeenCalledWith('Candidate search run candidate-smoke');
    expect(log).toHaveBeenCalledWith('Winner: baseline (score 0.95)');
    expect(log).toHaveBeenCalledWith('Selection: /tmp/meta-harness/data/candidate-runs/candidate-smoke/selection.json');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runCandidateSearchCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing input to fail');
    }
    expect(result.error).toBe('error: run-candidate-search failed: missing required --data-root and one of --input or --input-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('emits one JSON payload with search, held-out, warnings, and output paths', async () => {
    const log = vi.fn();

    const result = await runCandidateSearchCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--input',
        JSON.stringify({ runId: 'candidate-smoke', referenceTime: '2026-04-26T12:00:00.000Z' }),
        '--json'
      ],
      { log },
      {
        error: vi.fn(),
        benchmarkFixtures: fixtures,
        listMemoryRecords: vi.fn().mockResolvedValue(memories),
        listArtifactRecords: vi.fn().mockResolvedValue({ records: artifacts, warnings: ['warning: skipped artifact record ignored.json'] }),
        runSearch: vi.fn().mockResolvedValue(searchResult()),
        validateHeldOut: vi.fn().mockResolvedValue(evaluationResult('held-out', 0.9))
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      search: searchResult(),
      heldOut: evaluationResult('held-out', 0.9),
      warnings: ['warning: skipped artifact record ignored.json'],
      paths: {
        selection: '/tmp/meta-harness/data/candidate-runs/candidate-smoke/selection.json'
      }
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(result.output);
  });

  it('uses the real core loop to write search and held-out artifacts', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-cli-'));
    tempDirectories.push(dataRoot);

    const result = await runCandidateSearchCommand(
      [
        '--data-root',
        dataRoot,
        '--input',
        JSON.stringify({ runId: 'candidate-smoke', referenceTime: '2026-04-26T12:00:00.000Z' }),
        '--json'
      ],
      { log: vi.fn() },
      {
        error: vi.fn(),
        benchmarkFixtures: fixtures,
        listMemoryRecords: vi.fn().mockResolvedValue([]),
        listArtifactRecords: vi.fn().mockResolvedValue([])
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    const payload = JSON.parse(result.output) as { search: CandidateSearchResult; heldOut: CandidateEvaluationResult };
    const selectionJson = await readFile(join(dataRoot, 'data/candidate-runs/candidate-smoke/selection.json'), 'utf8');
    const heldOutSummary = await readFile(
      join(dataRoot, `data/candidate-runs/candidate-smoke/candidates/${payload.search.winner.candidateId}/held-out/summary.json`),
      'utf8'
    );

    expect(payload.search.trainFixtureCount).toBe(1);
    expect(payload.heldOut.summary.split).toBe('held-out');
    expect(selectionJson).toContain('"heldOut"');
    expect(heldOutSummary).toContain('"split": "held-out"');
  });
});

describe('run-candidate-search CLI wiring', () => {
  it('includes run-candidate-search in help output', () => {
    expect(renderHelp()).toContain('run-candidate-search');
  });

  it('dispatches run-candidate-search via the injected command handler', async () => {
    const log = vi.fn();
    const runCandidateSearch = vi.fn().mockResolvedValue({ success: true, exitCode: 0, output: 'candidate-smoke' });

    const result = await run(['run-candidate-search', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      runCandidateSearch
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'candidate-smoke' });
    expect(runCandidateSearch).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });
});
