import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import {
  writeCandidateArtifacts,
  writeCandidateFixtureTrace,
  writeCandidateSplitSummary
} from '../../src/index';
import { baselineCandidate } from './candidate.test';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('candidate store', () => {
  it('writes candidate json and policy snapshot under the candidate run directory', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-store-'));
    tempDirectories.push(dataRoot);

    const result = await writeCandidateArtifacts(dataRoot, 'run-001', baselineCandidate);

    expect(result.candidatePath).toBe(join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/candidate.json'));
    expect(result.policySnapshotPath).toBe(join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/candidate.policy.ts'));
    await expect(readFile(result.candidatePath, 'utf8')).resolves.toBe(`${JSON.stringify(baselineCandidate, null, 2)}\n`);
    await expect(readFile(result.policySnapshotPath, 'utf8')).resolves.toContain('export const candidatePolicy =');
  });

  it('writes split summaries and per-fixture trace files', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-store-'));
    tempDirectories.push(dataRoot);

    const summaryPath = await writeCandidateSplitSummary(dataRoot, 'run-001', 'baseline', 'search', {
      candidateId: 'baseline',
      split: 'search',
      fixtureCount: 1,
      metrics: { packetCompleteness: 1 }
    });
    const tracePath = await writeCandidateFixtureTrace(dataRoot, 'run-001', 'baseline', 'search', 'fixture-001', {
      candidateId: 'baseline',
      fixtureId: 'fixture-001',
      packetId: 'packet-001',
      metrics: { packetCompleteness: 1 }
    });

    expect(summaryPath).toBe(join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/search/summary.json'));
    expect(tracePath).toBe(join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/search/fixtures/fixture-001.json'));
    await expect(readFile(summaryPath, 'utf8')).resolves.toContain('"fixtureCount": 1');
    await expect(readFile(tracePath, 'utf8')).resolves.toContain('"packetId": "packet-001"');
  });

  it('rejects path traversal in run, candidate, and fixture ids', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-candidate-store-'));
    tempDirectories.push(dataRoot);

    await expect(writeCandidateArtifacts(dataRoot, '../run', baselineCandidate)).rejects.toThrow(/path segment/i);
    await expect(writeCandidateSplitSummary(dataRoot, 'run-001', '../candidate', 'search', {})).rejects.toThrow(/path segment/i);
    await expect(
      writeCandidateFixtureTrace(dataRoot, 'run-001', 'baseline', 'held-out', '../fixture', {})
    ).rejects.toThrow(/path segment/i);
  });
});
