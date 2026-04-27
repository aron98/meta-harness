import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parseCandidate, type Candidate } from './candidate';
import {
  getCandidateFixtureResultPath,
  getCandidateManifestPath,
  getCandidatePolicySnapshotPath,
  getCandidateSearchSummaryPath,
  getCandidateValidationSummaryPath,
  type CandidateEvaluationPartition
} from './candidate-paths';
import { renderCandidatePolicySnapshot } from './render-candidate-policy';
import { writeJsonFile } from '../write-json-file';

export type WriteCandidateArtifactsResult = {
  candidatePath: string;
  policySnapshotPath: string;
};

export async function writeCandidateArtifacts(
  dataRoot: string,
  runId: string,
  candidateInput: Candidate
): Promise<WriteCandidateArtifactsResult> {
  const candidate = parseCandidate(candidateInput);
  const candidatePath = await writeJsonFile(getCandidateManifestPath(dataRoot, runId, candidate.id), candidate);
  const policySnapshotPath = getCandidatePolicySnapshotPath(dataRoot, runId, candidate.id);

  await mkdir(dirname(policySnapshotPath), { recursive: true });
  await writeFile(policySnapshotPath, renderCandidatePolicySnapshot(candidate), 'utf8');

  return { candidatePath, policySnapshotPath };
}

export async function writeCandidateSplitSummary(
  dataRoot: string,
  runId: string,
  candidateId: string,
  partition: CandidateEvaluationPartition,
  summary: unknown
): Promise<string> {
  const summaryPath = partition === 'search'
    ? getCandidateSearchSummaryPath(dataRoot, runId, candidateId)
    : getCandidateValidationSummaryPath(dataRoot, runId, candidateId);

  return writeJsonFile(summaryPath, summary);
}

export async function writeCandidateFixtureTrace(
  dataRoot: string,
  runId: string,
  candidateId: string,
  partition: CandidateEvaluationPartition,
  fixtureId: string,
  trace: unknown
): Promise<string> {
  return writeJsonFile(getCandidateFixtureResultPath(dataRoot, runId, candidateId, partition, fixtureId), trace);
}
