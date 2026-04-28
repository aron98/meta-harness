import { join } from 'node:path';

import { assertValidPathSegment } from '../storage-paths';

export type CandidateEvaluationPartition = 'search' | 'held-out';

function getCandidateRunRoot(dataRoot: string, runId: string): string {
  return join(dataRoot, 'data', 'candidate-runs', assertValidPathSegment('runId', runId));
}

function getCandidateRoot(dataRoot: string, runId: string, candidateId: string): string {
  return join(
    getCandidateRunRoot(dataRoot, runId),
    'candidates',
    assertValidPathSegment('candidateId', candidateId)
  );
}

export function getCandidateRunManifestPath(dataRoot: string, runId: string): string {
  return join(getCandidateRunRoot(dataRoot, runId), 'run.json');
}

export function getCandidateSelectionPath(dataRoot: string, runId: string): string {
  return join(getCandidateRunRoot(dataRoot, runId), 'selection.json');
}

export function getCandidateManifestPath(dataRoot: string, runId: string, candidateId: string): string {
  return join(getCandidateRoot(dataRoot, runId, candidateId), 'candidate.json');
}

export function getCandidatePolicySnapshotPath(dataRoot: string, runId: string, candidateId: string): string {
  return join(getCandidateRoot(dataRoot, runId, candidateId), 'candidate.policy.ts');
}

export function getCandidateSearchSummaryPath(dataRoot: string, runId: string, candidateId: string): string {
  return join(getCandidateRoot(dataRoot, runId, candidateId), 'search', 'summary.json');
}

export function getCandidateValidationSummaryPath(dataRoot: string, runId: string, candidateId: string): string {
  return join(getCandidateRoot(dataRoot, runId, candidateId), 'held-out', 'summary.json');
}

export function getCandidateFixtureResultPath(
  dataRoot: string,
  runId: string,
  candidateId: string,
  partition: CandidateEvaluationPartition,
  fixtureId: string
): string {
  return join(
    getCandidateRoot(dataRoot, runId, candidateId),
    partition,
    'fixtures',
    `${assertValidPathSegment('fixtureId', fixtureId)}.json`
  );
}
