import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { runCandidateSearch } from '../../src/index';
import { baselineCandidate } from './candidate.test';

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

  it('uses explicit candidates without generating mutation combinations', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-search-'));
    tempDirectories.push(dataRoot);

    const result = await runCandidateSearch({
      dataRoot,
      runId: 'run-explicit-candidates',
      fixtures: [],
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z',
      candidates: [baselineCandidate],
      searchConfig: {
        mutations: [
          {
            id: 'custom-a',
            label: 'Custom A',
            section: 'retrieval',
            field: 'repoMatchWeight',
            value: 5
          },
          {
            id: 'custom-b',
            label: 'Custom B',
            section: 'verification',
            field: 'includeMemoryCommandHints',
            value: false
          }
        ],
        maxCombinationSize: 2,
        maxCandidates: 1
      }
    });

    expect(result.candidates.map((candidate) => candidate.candidateId)).toEqual(['baseline']);
  });

  it('passes custom objective config through winner selection using train fixtures only', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-search-'));
    tempDirectories.push(dataRoot);
    const sparseCandidate = {
      ...baselineCandidate,
      id: 'sparse-context',
      label: 'Sparse context',
      policy: {
        ...baselineCandidate.policy,
        context: {
          maxMemories: 0,
          maxArtifacts: 0
        }
      }
    };

    const result = await runCandidateSearch({
      dataRoot,
      runId: 'run-custom-objective',
      fixtures: [
        {
          id: 'train-retry',
          title: 'Implement retry helper',
          prompt: 'Implement a retry helper and run tests.',
          route: 'implement',
          split: 'train',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run pnpm test'],
          tags: ['retry']
        },
        {
          id: 'held-out-retry',
          title: 'Held-out retry helper',
          prompt: 'Implement another retry helper and run tests.',
          route: 'implement',
          split: 'held-out',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run pnpm test'],
          tags: ['retry']
        }
      ],
      memoryRecords: [
        {
          id: 'memory-retry',
          scope: 'repo-local',
          repoId: 'repo-a',
          kind: 'summary',
          value: 'Retry implementations should run pnpm test.',
          source: 'human-input',
          sourceArtifactIds: [],
          confidence: 'high',
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z'
        }
      ],
      artifactRecords: [
        {
          id: 'artifact-retry',
          repoId: 'repo-a',
          taskId: 'implement-retry-artifact',
          taskType: 'codegen',
          outcome: 'success',
          promptSummary: 'Retry helper implementation with pnpm test verification.',
          tags: ['retry'],
          filesInspected: ['src/retry.ts'],
          filesChanged: ['src/retry.ts'],
          commands: ['pnpm test'],
          diagnostics: [],
          verification: ['pnpm test'],
          createdAt: '2026-04-21T00:00:00.000Z'
        }
      ],
      referenceTime: '2026-04-26T00:00:00.000Z',
      candidates: [baselineCandidate, sparseCandidate],
      objectiveConfig: {
        selectedRecordPenalty: 10,
        selectedCommandPenalty: 10
      }
    });

    expect(result.trainFixtureCount).toBe(1);
    expect(result.heldOutFixtureCount).toBe(1);
    expect(result.winner.candidateId).toBe('sparse-context');
    expect(result.winner.summary.scoreContributions).toMatchObject({
      selectedRecordPenalty: 0,
      selectedCommandPenalty: 0
    });
  });
});
