import { z } from 'zod';

import { taskTypeSchema } from './artifact-record';
import { fixtureRouteSchema } from './fixture-authoring-schema';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const runtimeVerificationStatusSchema = z.enum(['pending', 'passed', 'failed', 'skipped']);

export const runtimeVerificationStateSchema = z
  .object({
    status: runtimeVerificationStatusSchema,
    checklist: z.array(nonEmptyStringSchema),
    completedSteps: z.array(nonEmptyStringSchema)
  })
  .superRefine((value, ctx) => {
    const checklistSteps = new Set(value.checklist);

    for (const [index, completedStep] of value.completedSteps.entries()) {
      if (!checklistSteps.has(completedStep)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'completedSteps entries must also exist in checklist',
          path: ['completedSteps', index]
        });
      }
    }
  });

export const taskStartEventSchema = z
  .object({
    id: nonEmptyStringSchema,
    repoId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema.optional(),
    taskType: taskTypeSchema,
    taskText: nonEmptyStringSchema,
    selectedMemoryIds: z.array(nonEmptyStringSchema),
    selectedArtifactIds: z.array(nonEmptyStringSchema),
    suggestedRoute: fixtureRouteSchema,
    verificationState: runtimeVerificationStateSchema,
    unresolvedQuestions: z.array(nonEmptyStringSchema),
    createdAt: isoDatetimeSchema,
    startedAt: isoDatetimeSchema
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.startedAt) < Date.parse(value.createdAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task-start events require startedAt to be on or after createdAt',
        path: ['startedAt']
      });
    }
  });

export type RuntimeVerificationStatus = z.infer<typeof runtimeVerificationStatusSchema>;
export type RuntimeVerificationState = z.infer<typeof runtimeVerificationStateSchema>;
export type TaskStartEvent = z.infer<typeof taskStartEventSchema>;

export function parseTaskStartEvent(input: unknown): TaskStartEvent {
  return taskStartEventSchema.parse(input);
}
