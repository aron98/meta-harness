import { describe, expect, it } from 'vitest';

import {
  parseCandidateObjectiveConfig,
  scoreCandidateObjective,
  scoreCandidateSummary,
  selectCandidateSearchWinner,
  type Candidate,
  type CandidateEvaluationResult
} from '../../src/index';

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
      score: 0,
      scoreContributions: {
        packetCompleteness: 0,
        routeHitRate: 0,
        verificationChecklistCoverage: 0,
        expectedTagHitRate: 0,
        selectedRecordPenalty: 0,
        selectedCommandPenalty: 0
      }
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

  it('keeps default objective parity with existing scoring', () => {
    expect(scoreCandidateSummary(result('candidate-a', 0.75, 2).summary)).toBe(2.23);
  });

  it('parses strict objective config defaults', () => {
    const configWithUnknownKey: Record<string, number> = { unexpectedWeight: 1 };

    expect(parseCandidateObjectiveConfig({})).toEqual({
      packetCompletenessWeight: 1,
      routeHitRateWeight: 1,
      verificationChecklistCoverageWeight: 1,
      expectedTagHitRateWeight: 0,
      selectedRecordPenalty: 0.01,
      selectedCommandPenalty: 0
    });

    expect(() => parseCandidateObjectiveConfig(configWithUnknownKey)).toThrow();
  });

  it('returns score contributions with exact objective keys', () => {
    const objective = scoreCandidateObjective(result('candidate-a', 1, 2).summary, {
      expectedTagHitRateWeight: 0.5,
      selectedCommandPenalty: 0.25
    });

    expect(objective.contributions).toEqual({
      packetCompleteness: 1,
      routeHitRate: 1,
      verificationChecklistCoverage: 1,
      expectedTagHitRate: 0.5,
      selectedRecordPenalty: -0.02,
      selectedCommandPenalty: 0
    });
    expect(objective.score).toBe(3.48);
  });

  it('uses custom expected tag weight and command penalty', () => {
    expect(
      scoreCandidateSummary(result('candidate-a', 0.8, 1).summary, {
        expectedTagHitRateWeight: 2,
        selectedCommandPenalty: 0.5
      })
    ).toBe(3.99);
  });

  it('selects by higher score, fewer selected records, then lexical candidate id', () => {
    const winner = selectCandidateSearchWinner([
      result('candidate-c', 0.8, 2),
      result('candidate-b', 0.8, 1),
      result('candidate-a', 0.8, 1)
    ]);

    expect(winner.candidateId).toBe('candidate-a');
  });

  it('preserves winner tie-breaks with custom objective config', () => {
    const winner = selectCandidateSearchWinner(
      [result('candidate-c', 0.8, 1), result('candidate-b', 0.8, 2), result('candidate-a', 0.8, 1)],
      { selectedRecordPenalty: 0 }
    );

    expect(winner.candidateId).toBe('candidate-a');
  });

  it('returns winner summary score and contributions for the custom objective used to rank', () => {
    const customObjective = {
      expectedTagHitRateWeight: 2,
      selectedCommandPenalty: 0.5
    };
    const winner = selectCandidateSearchWinner(
      [result('candidate-a', 0.8, 1), result('candidate-b', 0.7, 0)],
      customObjective
    );
    const objective = scoreCandidateObjective(winner.summary, customObjective);

    expect(winner.summary.score).toBe(scoreCandidateSummary(winner.summary, customObjective));
    expect(winner.summary.scoreContributions).toEqual(objective.contributions);
  });
});
