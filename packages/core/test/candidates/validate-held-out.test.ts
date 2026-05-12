import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { runCandidateSearch, validateHeldOutCandidate } from '../../src/index';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('validateHeldOutCandidate', () => {
  it('evaluates only the selected winner on held-out fixtures and preserves selection', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-held-out-'));
    tempDirectories.push(dataRoot);
    const fixtures = [
      {
        id: 'train-implement',
        title: 'Implement retry helper',
        prompt: 'Implement a retry helper.',
        route: 'implement' as const,
        split: 'train' as const,
        repo: { id: 'repo-a', maturity: 'active' as const },
        routeHints: ['implement' as const],
        checklistHints: ['Run the smallest relevant verification command after implementation'],
        tags: ['implement']
      },
      {
        id: 'held-out-plan',
        title: 'Plan migration',
        prompt: 'Plan the migration.',
        route: 'plan' as const,
        split: 'held-out' as const,
        repo: { id: 'repo-a', maturity: 'legacy' as const },
        routeHints: ['plan' as const],
        checklistHints: ['Identify migration dependencies'],
        tags: ['plan']
      }
    ];
    const search = await runCandidateSearch({
      dataRoot,
      runId: 'run-001',
      fixtures,
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z'
    });

    const heldOut = await validateHeldOutCandidate({
      dataRoot,
      runId: 'run-001',
      candidate: search.winner.candidate,
      fixtures,
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z',
      selection: search.winner
    });

    expect(heldOut.summary.split).toBe('held-out');
    expect(heldOut.summary.fixtureCount).toBe(1);
    expect(heldOut.candidateId).toBe(search.winner.candidateId);
    expect(search.trainFixtureCount).toBe(1);
    expect(search.heldOutFixtureCount).toBe(1);

    const heldOutSummary = await readFile(
      join(dataRoot, `data/candidate-runs/run-001/candidates/${search.winner.candidateId}/held-out/summary.json`),
      'utf8'
    );
    const heldOutTrace = await readFile(
      join(dataRoot, `data/candidate-runs/run-001/candidates/${search.winner.candidateId}/held-out/fixtures/held-out-plan.json`),
      'utf8'
    );
    const selectionJson = await readFile(join(dataRoot, 'data/candidate-runs/run-001/selection.json'), 'utf8');
    const selection = JSON.parse(selectionJson) as {
      search?: { candidateId: string; split: string };
      heldOut?: { candidateId: string; split: string };
    };

    expect(heldOutSummary).toContain('"split": "held-out"');
    expect(heldOutTrace).toContain('"fixtureId": "held-out-plan"');
    expect(selectionJson).toContain('"heldOut"');
    expect(selectionJson).toContain(`"candidateId": "${search.winner.candidateId}"`);
    expect(selection.search).toMatchObject({ candidateId: search.winner.candidateId, split: 'search' });
    expect(selection.heldOut).toMatchObject({ candidateId: search.winner.candidateId, split: 'held-out' });
  });

  it('uses custom objective config when scoring held-out summaries', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-held-out-'));
    tempDirectories.push(dataRoot);
    const fixtures = [
      {
        id: 'train-implement',
        title: 'Implement retry helper',
        prompt: 'Implement a retry helper and run tests.',
        route: 'implement' as const,
        split: 'train' as const,
        repo: { id: 'repo-a', maturity: 'active' as const },
        routeHints: ['implement' as const],
        checklistHints: ['Run pnpm test'],
        tags: ['retry']
      },
      {
        id: 'held-out-implement',
        title: 'Implement held-out retry helper',
        prompt: 'Implement another retry helper and run tests.',
        route: 'implement' as const,
        split: 'held-out' as const,
        repo: { id: 'repo-a', maturity: 'active' as const },
        routeHints: ['implement' as const],
        checklistHints: ['Run pnpm test'],
        tags: ['retry']
      }
    ];
    const artifactRecords = [
      {
        id: 'artifact-retry',
        repoId: 'repo-a',
        taskId: 'implement-retry-artifact',
        taskType: 'codegen' as const,
        outcome: 'success' as const,
        promptSummary: 'Retry helper implementation with pnpm test verification.',
        tags: ['retry'],
        filesInspected: ['src/retry.ts'],
        filesChanged: ['src/retry.ts'],
        commands: ['pnpm test'],
        diagnostics: [],
        verification: [],
        createdAt: '2026-04-21T00:00:00.000Z'
      }
    ];
    const objectiveConfig = { selectedCommandPenalty: 1 };
    const search = await runCandidateSearch({
      dataRoot,
      runId: 'run-custom-held-out-objective',
      fixtures,
      memoryRecords: [],
      artifactRecords,
      referenceTime: '2026-04-26T00:00:00.000Z',
      objectiveConfig
    });

    const heldOut = await validateHeldOutCandidate({
      dataRoot,
      runId: 'run-custom-held-out-objective',
      candidate: search.winner.candidate,
      fixtures,
      memoryRecords: [],
      artifactRecords,
      referenceTime: '2026-04-26T00:00:00.000Z',
      selection: search.winner,
      objectiveConfig
    });

    expect(heldOut.summary.metrics.selectedCommandCount).toBe(1);
    expect(heldOut.summary.scoreContributions?.selectedCommandPenalty).toBe(-1);
  });
});
