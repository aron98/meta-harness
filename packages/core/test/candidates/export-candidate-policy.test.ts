import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { exportCandidatePolicy } from '../../src/index';
import { baselineCandidate } from './candidate.test';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('exportCandidatePolicy', () => {
  it('reads the selected candidate snapshot and writes a runtime policy artifact', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-export-'));
    tempDirectories.push(dataRoot);
    const runId = 'run-export';
    const candidateRoot = join(dataRoot, 'data/candidate-runs', runId, 'candidates', baselineCandidate.id);
    const outputFile = join(dataRoot, 'winner-policy.json');

    await mkdir(candidateRoot, { recursive: true });
    await writeFile(
      join(dataRoot, 'data/candidate-runs', runId, 'selection.json'),
      JSON.stringify({ runId, candidateId: baselineCandidate.id, score: 2.5 }),
      'utf8'
    );
    await writeFile(join(candidateRoot, 'candidate.json'), JSON.stringify(baselineCandidate), 'utf8');

    const result = await exportCandidatePolicy({ dataRoot, runId, outputFile });
    const artifact = JSON.parse(await readFile(outputFile, 'utf8'));

    expect(result).toEqual({ runId, candidateId: baselineCandidate.id, outputFile });
    expect(artifact).toEqual({
      runId,
      candidateId: baselineCandidate.id,
      policy: baselineCandidate.policy
    });
  });
});
