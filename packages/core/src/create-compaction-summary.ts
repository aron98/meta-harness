import { parseCompactionSummary, type CompactionSummary } from './compaction-summary';

export type CreateCompactionSummaryInput = CompactionSummary;

export const COMPACTION_SUMMARY_LIMITS = {
  maxTaskTextLength: 280,
  maxSelectedMemoryIds: 3,
  maxSelectedArtifactIds: 2,
  maxVerificationChecklistSteps: 5,
  maxCompletedVerificationSteps: 5,
  maxUnresolvedQuestions: 3
} as const;

function limitString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function limitItems(values: readonly string[], maxItems: number): string[] {
  return values.slice(0, maxItems);
}

export function createCompactionSummary(input: CreateCompactionSummaryInput): CompactionSummary {
  const checklist = limitItems(
    input.verificationState.checklist,
    COMPACTION_SUMMARY_LIMITS.maxVerificationChecklistSteps
  );
  const allowedCompletedSteps = new Set(checklist);
  const completedSteps = limitItems(
    input.verificationState.completedSteps.filter((step) => allowedCompletedSteps.has(step)),
    COMPACTION_SUMMARY_LIMITS.maxCompletedVerificationSteps
  );

  return parseCompactionSummary({
    ...input,
    taskText: limitString(input.taskText, COMPACTION_SUMMARY_LIMITS.maxTaskTextLength),
    selectedMemoryIds: limitItems(input.selectedMemoryIds, COMPACTION_SUMMARY_LIMITS.maxSelectedMemoryIds),
    selectedArtifactIds: limitItems(input.selectedArtifactIds, COMPACTION_SUMMARY_LIMITS.maxSelectedArtifactIds),
    verificationState: {
      status: input.verificationState.status,
      checklist,
      completedSteps
    },
    unresolvedQuestions: limitItems(
      input.unresolvedQuestions,
      COMPACTION_SUMMARY_LIMITS.maxUnresolvedQuestions
    )
  });
}
