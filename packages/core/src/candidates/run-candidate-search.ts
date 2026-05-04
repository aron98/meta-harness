import type { ArtifactRecord } from '../artifact-record';
import type { MemoryRecord } from '../memory-record';
import { writeJsonFile } from '../write-json-file';
import { parseCandidate, type Candidate } from './candidate';
import { getCandidateRunManifestPath, getCandidateSelectionPath } from './candidate-paths';
import { evaluateCandidate, type CandidateBenchmarkFixture, type CandidateEvaluationResult } from './evaluate-candidate';
import type { CandidateObjectiveConfigInput } from './objective-config';
import { selectCandidateSearchWinner } from './search-objective';
import { writeCandidateArtifacts, writeCandidateFixtureTrace, writeCandidateSplitSummary } from './candidate-store';
import { generateCandidateSearchCandidates, type CandidateSearchConfigInput } from './search-config';

export type RunCandidateSearchInput = {
  dataRoot: string;
  runId: string;
  fixtures: readonly CandidateBenchmarkFixture[];
  memoryRecords: readonly MemoryRecord[];
  artifactRecords: readonly ArtifactRecord[];
  referenceTime: string;
  maxMemories?: number;
  maxArtifacts?: number;
  candidates?: readonly Candidate[];
  searchConfig?: CandidateSearchConfigInput;
  objectiveConfig?: CandidateObjectiveConfigInput;
};

export type CandidateSearchResult = {
  runId: string;
  trainFixtureCount: number;
  heldOutFixtureCount: number;
  candidates: CandidateEvaluationResult[];
  winner: CandidateEvaluationResult;
};

export async function runCandidateSearch(input: RunCandidateSearchInput): Promise<CandidateSearchResult> {
  const trainFixtures = input.fixtures.filter((fixture) => fixture.split === 'train');
  const heldOutFixtures = input.fixtures.filter((fixture) => fixture.split === 'held-out');
  const candidates = input.candidates === undefined
    ? generateCandidateSearchCandidates({ referenceTime: input.referenceTime, searchConfig: input.searchConfig })
    : input.candidates.map(parseCandidate);
  const results = candidates.map((candidate) => evaluateCandidate({
    candidate,
    split: 'search',
    fixtures: trainFixtures,
    memoryRecords: input.memoryRecords,
    artifactRecords: input.artifactRecords,
    referenceTime: input.referenceTime,
    maxMemories: input.maxMemories,
    maxArtifacts: input.maxArtifacts,
    objectiveConfig: input.objectiveConfig
  }));
  const winner = selectCandidateSearchWinner(results, input.objectiveConfig);
  const runManifest = {
    runId: input.runId,
    createdAt: input.referenceTime,
    candidateCount: candidates.length,
    trainFixtureCount: trainFixtures.length,
    heldOutFixtureCount: heldOutFixtures.length
  };
  const selection = {
    runId: input.runId,
    candidateId: winner.candidateId,
    score: winner.summary.score,
    summary: winner.summary
  };

  await writeJsonFile(getCandidateRunManifestPath(input.dataRoot, input.runId), runManifest);

  for (const candidate of candidates) {
    await writeCandidateArtifacts(input.dataRoot, input.runId, candidate);
  }

  for (const result of results) {
    await writeCandidateSplitSummary(input.dataRoot, input.runId, result.candidateId, 'search', result.summary);

    for (const trace of result.fixtures) {
      await writeCandidateFixtureTrace(input.dataRoot, input.runId, result.candidateId, 'search', trace.fixtureId, trace);
    }
  }

  await writeJsonFile(getCandidateSelectionPath(input.dataRoot, input.runId), selection);

  return {
    runId: input.runId,
    trainFixtureCount: trainFixtures.length,
    heldOutFixtureCount: heldOutFixtures.length,
    candidates: results,
    winner
  };
}
