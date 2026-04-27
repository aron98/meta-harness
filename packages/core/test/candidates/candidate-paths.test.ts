import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getCandidateFixtureResultPath,
  getCandidateManifestPath,
  getCandidatePolicySnapshotPath,
  getCandidateRunManifestPath,
  getCandidateSearchSummaryPath,
  getCandidateSelectionPath,
  getCandidateValidationSummaryPath
} from '../../src/index';

describe('candidate run paths', () => {
  it('builds safe paths under data/candidate-runs/<run-id>', () => {
    const dataRoot = '/tmp/meta-harness';

    expect(getCandidateRunManifestPath(dataRoot, 'run-001')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/run.json')
    );
    expect(getCandidateSelectionPath(dataRoot, 'run-001')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/selection.json')
    );
    expect(getCandidateManifestPath(dataRoot, 'run-001', 'baseline')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/candidate.json')
    );
    expect(getCandidatePolicySnapshotPath(dataRoot, 'run-001', 'baseline')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/candidate.policy.ts')
    );
    expect(getCandidateSearchSummaryPath(dataRoot, 'run-001', 'baseline')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/search/summary.json')
    );
    expect(getCandidateValidationSummaryPath(dataRoot, 'run-001', 'baseline')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/held-out/summary.json')
    );
    expect(getCandidateFixtureResultPath(dataRoot, 'run-001', 'baseline', 'search', 'fixture-001')).toBe(
      join(dataRoot, 'data/candidate-runs/run-001/candidates/baseline/search/fixtures/fixture-001.json')
    );
  });

  it('rejects path traversal through run, candidate, and fixture ids', () => {
    expect(() => getCandidateRunManifestPath('/tmp/meta-harness', '../run')).toThrow(/path segment/i);
    expect(() => getCandidateManifestPath('/tmp/meta-harness', 'run-001', 'candidate/001')).toThrow(/path segment/i);
    expect(() =>
      getCandidateFixtureResultPath('/tmp/meta-harness', 'run-001', 'baseline', 'held-out', '..')
    ).toThrow(/path segment/i);
  });
});
