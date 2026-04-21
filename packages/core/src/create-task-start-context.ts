import type { ArtifactRecord } from './artifact-record';
import type { MemoryRecord } from './memory-record';
import { prepareSessionPacket, type PrepareSessionPacketInput } from './prepare-session-packet';
import { parseRuntimeTaskContext, type RuntimeTaskContext } from './runtime-task-context';
import {
  parseTaskStartEvent,
  type RuntimeVerificationStatus,
  type TaskStartEvent
} from './task-start-event';

type CreateTaskStartVerificationState = {
  status?: RuntimeVerificationStatus;
  completedSteps?: string[];
};

export type CreateTaskStartContextInput = PrepareSessionPacketInput & {
  eventId?: string;
  unresolvedQuestions?: string[];
  verificationState?: CreateTaskStartVerificationState;
};

export type CreateTaskStartContextResult = {
  taskStart: TaskStartEvent;
  context: RuntimeTaskContext;
};

function selectRecords<T extends { id: string }>(selectedIds: readonly string[], records: readonly T[]): T[] {
  const recordById = new Map(records.map((record) => [record.id, record]));

  return selectedIds.flatMap((id) => {
    const record = recordById.get(id);
    return record === undefined ? [] : [record];
  });
}

function buildVerificationState(
  checklist: readonly string[],
  overrides: CreateTaskStartContextInput['verificationState']
) {
  return {
    status: overrides?.status ?? 'pending',
    checklist: [...checklist],
    completedSteps: overrides?.completedSteps ?? []
  };
}

export function createTaskStartContext(input: CreateTaskStartContextInput): CreateTaskStartContextResult {
  const packet = prepareSessionPacket(input);
  const selectedMemories = selectRecords<MemoryRecord>(packet.selectedMemoryIds, input.memoryRecords);
  const selectedArtifacts = selectRecords<ArtifactRecord>(packet.selectedArtifactIds, input.artifactRecords);
  const verificationState = buildVerificationState(packet.verificationChecklist, input.verificationState);

  const taskStart = parseTaskStartEvent({
    id: input.eventId ?? `${packet.id}-start`,
    repoId: input.repoId,
    taskId: input.taskId,
    taskType: packet.taskType,
    taskText: input.prompt,
    selectedMemoryIds: packet.selectedMemoryIds,
    selectedArtifactIds: packet.selectedArtifactIds,
    suggestedRoute: packet.suggestedRoute,
    verificationState,
    unresolvedQuestions: input.unresolvedQuestions ?? [],
    createdAt: input.referenceTime,
    startedAt: input.referenceTime
  });

  const context = parseRuntimeTaskContext({
    repoId: input.repoId,
    taskId: input.taskId,
    prompt: input.prompt,
    packet,
    selectedMemories,
    selectedArtifacts,
    taskStart,
    verificationState,
    unresolvedQuestions: input.unresolvedQuestions ?? [],
    createdAt: input.referenceTime
  });

  return { taskStart, context };
}
