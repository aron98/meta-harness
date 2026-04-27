import type { ArtifactRecord, TaskType } from './artifact-record';
import type { MemoryRecord } from './memory-record';

export type VerificationChecklistInput = {
  taskType: TaskType;
  prompt: string;
  selectedMemories: readonly MemoryRecord[];
  selectedArtifacts: readonly ArtifactRecord[];
  policy?: VerificationChecklistPolicyInput;
};

export type VerificationChecklistPolicyInput = {
  includeArtifactVerificationCommands?: boolean;
  includeMemoryCommandHints?: boolean;
  requirePromptClarificationOnUnclear?: boolean;
};

const taskTypeChecklistItems: Record<TaskType, string[]> = {
  analysis: ['Confirm the findings are supported by inspected evidence.'],
  codegen: ['Run the smallest relevant verification command after implementation.'],
  documentation: ['Check that the explanation matches the current repository state.'],
  fix: ['Reproduce or restate the failure mode before closing the task.'],
  planning: ['Ensure the proposed sequence covers dependencies and risks.'],
  verification: ['Capture the exact verification command results and status.']
};

export function buildVerificationChecklist(input: VerificationChecklistInput): string[] {
  const checklist = new Set<string>(taskTypeChecklistItems[input.taskType]);
  const policy = {
    includeArtifactVerificationCommands: true,
    includeMemoryCommandHints: true,
    requirePromptClarificationOnUnclear: true,
    ...input.policy
  };

  if (policy.includeArtifactVerificationCommands) {
    for (const artifact of input.selectedArtifacts) {
      for (const command of artifact.verification) {
        checklist.add(`Run ${command}.`);
      }
    }
  }

  if (policy.includeMemoryCommandHints) {
    for (const memory of input.selectedMemories) {
      if (/\bpnpm\b|\bnpm\b|\byarn\b|\btest\b|\bbuild\b/i.test(memory.value)) {
        checklist.add(memory.value.endsWith('.') ? memory.value : `${memory.value}.`);
      }
    }
  }

  if (policy.requirePromptClarificationOnUnclear && /\bunclear\b|\bmissing\b|\bquestion\b/i.test(input.prompt)) {
    checklist.add('Confirm unresolved assumptions with the user before proceeding.');
  }

  return Array.from(checklist);
}
