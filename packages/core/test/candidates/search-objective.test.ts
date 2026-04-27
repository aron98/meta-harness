import { describe, expect, it } from 'vitest';

import { scoreCandidateSummary, selectCandidateSearchWinner, type Candidate, type CandidateEvaluationResult } from '../../src/index';

function candidate(candidateId: string): Candidate {
  return {
    id: candidateId,
    label: candidateId,
    createdAt: '2026-04-26T00:00:00.000Z',
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
  };
}

function result(candidateId: string, packetCompleteness: number, selectedRecordCount: number): CandidateEvaluationResult {
  return {
    candidateId,
    candidate: candidate(candidateId),
    split: 'search',
    summary: {
      candidateId,
      split: 'search',
      fixtureCount: 1,
      metrics: {
        packetCompleteness,
        routeHitRate: packetCompleteness,
        expectedTagHitRate: packetCompleteness,
        verificationChecklistCoverage: packetCompleteness,
        selectedRecordCount,
        selectedCommandCount: 0
      },
      score: 0
    },
    fixtures: []
  };
}

describe('candidate search objective', () => {
  it('scores packet quality with a small selected-record penalty', () => {
    expect(scoreCandidateSummary(result('candidate-a', 1, 2).summary)).toBeGreaterThan(
      scoreCandidateSummary(result('candidate-b', 0.5, 0).summary)
    );
  });

  it('selects by higher score, fewer selected records, then lexical candidate id', () => {
    const winner = selectCandidateSearchWinner([
      result('candidate-c', 0.8, 2),
      result('candidate-b', 0.8, 1),
      result('candidate-a', 0.8, 1)
    ]);

    expect(winner.candidateId).toBe('candidate-a');
  });
});
