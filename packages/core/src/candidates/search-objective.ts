import type { CandidateEvaluationResult, CandidateEvaluationSummary } from './evaluate-candidate';
import { scoreCandidateObjective, type CandidateObjectiveConfigInput } from './objective-config';

export function scoreCandidateSummary(
  summary: CandidateEvaluationSummary,
  objectiveConfig: CandidateObjectiveConfigInput = {}
): number {
  return scoreCandidateObjective(summary, objectiveConfig).score;
}

export function selectCandidateSearchWinner(
  results: readonly CandidateEvaluationResult[],
  objectiveConfig: CandidateObjectiveConfigInput = {}
): CandidateEvaluationResult {
  if (results.length === 0) {
    throw new Error('candidate search requires at least one result');
  }

  const winner = [...results].sort((left, right) => {
    const scoreDelta = scoreCandidateSummary(right.summary, objectiveConfig) - scoreCandidateSummary(left.summary, objectiveConfig);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const selectedRecordDelta = left.summary.metrics.selectedRecordCount - right.summary.metrics.selectedRecordCount;

    if (selectedRecordDelta !== 0) {
      return selectedRecordDelta;
    }

    return left.candidateId.localeCompare(right.candidateId);
  })[0];
  const objective = scoreCandidateObjective(winner.summary, objectiveConfig);

  return {
    ...winner,
    summary: {
      ...winner.summary,
      score: objective.score,
      scoreContributions: objective.contributions
    }
  };
}
