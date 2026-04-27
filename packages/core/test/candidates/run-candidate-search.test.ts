import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { runCandidateSearch } from '../../src/index';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('runCandidateSearch', () => {
  it('evaluates train fixtures only, persists candidate artifacts, and selects one winner', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-search-'));
    tempDirectories.push(dataRoot);

    const result = await runCandidateSearch({
      dataRoot,
      runId: 'run-001',
      fixtures: [
        {
          id: 'train-implement',
          title: 'Implement retry helper',
          prompt: 'Implement a retry helper.',
          route: 'implement',
          split: 'train',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run the smallest relevant verification command after implementation'],
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
          checklistHints: ['Identify migration dependencies'],
          tags: ['plan']
        }
      ],
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z'
    });

    expect(result.trainFixtureCount).toBe(1);
    expect(result.heldOutFixtureCount).toBe(1);
    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.winner.candidateId).toBeTruthy();
    expect(result.winner.candidate.id).toBe(result.winner.candidateId);

    const runJson = await readFile(join(dataRoot, 'data/candidate-runs/run-001/run.json'), 'utf8');
    const selectionJson = await readFile(join(dataRoot, 'data/candidate-runs/run-001/selection.json'), 'utf8');
    const winnerTrace = await readFile(
      join(dataRoot, `data/candidate-runs/run-001/candidates/${result.winner.candidateId}/search/fixtures/train-implement.json`),
      'utf8'
    );

    expect(runJson).toContain('"trainFixtureCount": 1');
    expect(selectionJson).toContain(`"candidateId": "${result.winner.candidateId}"`);
    expect(winnerTrace).toContain('"fixtureId": "train-implement"');
  });
});
