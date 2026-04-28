import type { CandidateEvaluationResult, CandidateEvaluationSummary } from './evaluate-candidate';

export function scoreCandidateSummary(summary: CandidateEvaluationSummary): number {
  const quality =
    summary.metrics.packetCompleteness +
    summary.metrics.routeHitRate +
    summary.metrics.verificationChecklistCoverage;
  const selectedRecordPenalty = summary.metrics.selectedRecordCount * 0.01;

  return Number((quality - selectedRecordPenalty).toFixed(3));
}

export function selectCandidateSearchWinner(results: readonly CandidateEvaluationResult[]): CandidateEvaluationResult {
  if (results.length === 0) {
    throw new Error('candidate search requires at least one result');
  }

  return [...results].sort((left, right) => {
    const scoreDelta = scoreCandidateSummary(right.summary) - scoreCandidateSummary(left.summary);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const selectedRecordDelta = left.summary.metrics.selectedRecordCount - right.summary.metrics.selectedRecordCount;

    if (selectedRecordDelta !== 0) {
      return selectedRecordDelta;
    }

    return left.candidateId.localeCompare(right.candidateId);
  })[0];
}
