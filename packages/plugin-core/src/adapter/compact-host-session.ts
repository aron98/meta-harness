import {
  createCompactionSummary,
  type CompactionSummary,
  type CreateCompactionSummaryInput
} from '@meta-harness/core';

export type CompactHostSessionInput = CreateCompactionSummaryInput;
export type CompactHostSessionResult = CompactionSummary;

export function compactHostSession(input: CompactHostSessionInput): CompactHostSessionResult {
  return createCompactionSummary(input);
}
