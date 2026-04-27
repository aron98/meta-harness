import type { ArtifactRecord } from '../artifact-record';
import type { MemoryRecord } from '../memory-record';
import { writeJsonFile } from '../write-json-file';
import { getCandidateSelectionPath } from './candidate-paths';
import { evaluateCandidate, type CandidateBenchmarkFixture, type CandidateEvaluationResult } from './evaluate-candidate';
import { writeCandidateFixtureTrace, writeCandidateSplitSummary } from './candidate-store';
import type { Candidate } from './candidate';

export type ValidateHeldOutCandidateInput = {
  dataRoot: string;
  runId: string;
  candidate: Candidate;
  fixtures: readonly CandidateBenchmarkFixture[];
  memoryRecords: readonly MemoryRecord[];
  artifactRecords: readonly ArtifactRecord[];
  referenceTime: string;
  maxMemories?: number;
  maxArtifacts?: number;
  selection: CandidateEvaluationResult;
};

export async function validateHeldOutCandidate(input: ValidateHeldOutCandidateInput): Promise<CandidateEvaluationResult> {
  const heldOutFixtures = input.fixtures.filter((fixture) => fixture.split === 'held-out');
  const result = evaluateCandidate({
    candidate: input.candidate,
    split: 'held-out',
    fixtures: heldOutFixtures,
    memoryRecords: input.memoryRecords,
    artifactRecords: input.artifactRecords,
    referenceTime: input.referenceTime,
    maxMemories: input.maxMemories,
    maxArtifacts: input.maxArtifacts
  });

  await writeCandidateSplitSummary(input.dataRoot, input.runId, result.candidateId, 'held-out', result.summary);

  for (const trace of result.fixtures) {
    await writeCandidateFixtureTrace(input.dataRoot, input.runId, result.candidateId, 'held-out', trace.fixtureId, trace);
  }

  await writeJsonFile(getCandidateSelectionPath(input.dataRoot, input.runId), {
    runId: input.runId,
    candidateId: input.selection.candidateId,
    score: input.selection.summary.score,
    summary: input.selection.summary,
    heldOut: result.summary
  });

  return result;
}
