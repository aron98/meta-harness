import type { ArtifactRecord } from '../artifact-record';
import type { MemoryRecord } from '../memory-record';
import { writeJsonFile } from '../write-json-file';
import { parseCandidate, type Candidate } from './candidate';
import { getCandidateRunManifestPath, getCandidateSelectionPath } from './candidate-paths';
import { evaluateCandidate, type CandidateBenchmarkFixture, type CandidateEvaluationResult } from './evaluate-candidate';
import { enumerateCandidateMutations, type CandidateMutation } from './mutation-catalog';
import { selectCandidateSearchWinner } from './search-objective';
import { writeCandidateArtifacts, writeCandidateFixtureTrace, writeCandidateSplitSummary } from './candidate-store';

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
};

export type CandidateSearchResult = {
  runId: string;
  trainFixtureCount: number;
  heldOutFixtureCount: number;
  candidates: CandidateEvaluationResult[];
  winner: CandidateEvaluationResult;
};

function createBaselineCandidate(referenceTime: string): Candidate {
  return parseCandidate({
    id: 'baseline',
    label: 'Baseline policy',
    createdAt: referenceTime,
    mutationIds: [],
    policy: {
      retrieval: {
        repoMatchWeight: 10,
        tagOverlapWeight: 3,
        recentMaxBonus: 4,
        recentHalfLifeDays: 7,
        taskTypeWeight: 8,
        outcomeWeight: 4,
        taskLocalMemoryBonus: 1
      },
      routing: {
        taskTypeOrder: ['verification', 'planning', 'documentation', 'fix', 'codegen', 'analysis'],
        buildPromptMode: 'default'
      },
      verification: {
        includeArtifactVerificationCommands: true,
        includeMemoryCommandHints: true,
        requirePromptClarificationOnUnclear: true
      }
    }
  });
}

function applyMutation(candidate: Candidate, mutation: CandidateMutation, referenceTime: string): Candidate {
  return parseCandidate({
    ...candidate,
    id: mutation.id,
    label: mutation.label,
    baseCandidateId: candidate.id,
    createdAt: referenceTime,
    mutationIds: [mutation.id],
    policy: {
      ...candidate.policy,
      [mutation.section]: {
        ...candidate.policy[mutation.section],
        [mutation.field]: mutation.value
      }
    }
  });
}

function enumerateDefaultCandidates(referenceTime: string): Candidate[] {
  const baseline = createBaselineCandidate(referenceTime);

  return [baseline, ...enumerateCandidateMutations().map((mutation) => applyMutation(baseline, mutation, referenceTime))];
}

export async function runCandidateSearch(input: RunCandidateSearchInput): Promise<CandidateSearchResult> {
  const trainFixtures = input.fixtures.filter((fixture) => fixture.split === 'train');
  const heldOutFixtures = input.fixtures.filter((fixture) => fixture.split === 'held-out');
  const candidates = input.candidates === undefined ? enumerateDefaultCandidates(input.referenceTime) : input.candidates.map(parseCandidate);
  const results = candidates.map((candidate) => evaluateCandidate({
    candidate,
    split: 'search',
    fixtures: trainFixtures,
    memoryRecords: input.memoryRecords,
    artifactRecords: input.artifactRecords,
    referenceTime: input.referenceTime,
    maxMemories: input.maxMemories,
    maxArtifacts: input.maxArtifacts
  }));
  const winner = selectCandidateSearchWinner(results);
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
