import { z } from 'zod';

import { artifactRecordSchema } from './artifact-record';
import { memoryRecordSchema } from './memory-record';
import { sessionPacketSchema } from './session-packet';
import { runtimeVerificationStateSchema, taskStartEventSchema } from './task-start-event';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const runtimeTaskContextSchema = z
  .object({
    repoId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema.optional(),
    prompt: nonEmptyStringSchema,
    packet: sessionPacketSchema,
    selectedMemories: z.array(memoryRecordSchema),
    selectedArtifacts: z.array(artifactRecordSchema),
    taskStart: taskStartEventSchema,
    verificationState: runtimeVerificationStateSchema,
    unresolvedQuestions: z.array(nonEmptyStringSchema),
    createdAt: isoDatetimeSchema
  })
  .superRefine((value, ctx) => {
    if (value.repoId !== value.packet.repoId || value.repoId !== value.taskStart.repoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context repoId must match packet and taskStart repoId',
        path: ['repoId']
      });
    }

    if (value.taskId !== value.packet.taskId || value.taskId !== value.taskStart.taskId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context taskId must match packet and taskStart taskId',
        path: ['taskId']
      });
    }

    if (JSON.stringify(value.verificationState) !== JSON.stringify(value.taskStart.verificationState)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context verificationState must match taskStart verificationState',
        path: ['verificationState']
      });
    }

    if (JSON.stringify(value.verificationState.checklist) !== JSON.stringify(value.packet.verificationChecklist)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context verification checklist must match packet verificationChecklist',
        path: ['verificationState', 'checklist']
      });
    }

    if (JSON.stringify(value.unresolvedQuestions) !== JSON.stringify(value.taskStart.unresolvedQuestions)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context unresolvedQuestions must match taskStart unresolvedQuestions',
        path: ['unresolvedQuestions']
      });
    }

    const selectedMemoryIds = value.selectedMemories.map((record) => record.id);
    if (JSON.stringify(selectedMemoryIds) !== JSON.stringify(value.packet.selectedMemoryIds) || JSON.stringify(selectedMemoryIds) !== JSON.stringify(value.taskStart.selectedMemoryIds)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context selectedMemories must match packet and taskStart selectedMemoryIds',
        path: ['selectedMemories']
      });
    }

    const selectedArtifactIds = value.selectedArtifacts.map((record) => record.id);
    if (JSON.stringify(selectedArtifactIds) !== JSON.stringify(value.packet.selectedArtifactIds) || JSON.stringify(selectedArtifactIds) !== JSON.stringify(value.taskStart.selectedArtifactIds)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'runtime task context selectedArtifacts must match packet and taskStart selectedArtifactIds',
        path: ['selectedArtifacts']
      });
    }
  });

export type RuntimeTaskContext = z.infer<typeof runtimeTaskContextSchema>;

export function parseRuntimeTaskContext(input: unknown): RuntimeTaskContext {
  return runtimeTaskContextSchema.parse(input);
}
