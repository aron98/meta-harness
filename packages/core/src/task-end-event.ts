import { z } from 'zod';

import { artifactOutcomeSchema, taskTypeSchema } from './artifact-record';
import { fixtureRouteSchema } from './fixture-authoring-schema';
import { runtimeVerificationStateSchema } from './task-start-event';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const taskEndEventSchema = z
  .object({
    id: nonEmptyStringSchema,
    repoId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema.optional(),
    taskType: taskTypeSchema,
    taskText: nonEmptyStringSchema,
    promptSummary: nonEmptyStringSchema,
    selectedMemoryIds: z.array(nonEmptyStringSchema),
    selectedArtifactIds: z.array(nonEmptyStringSchema),
    suggestedRoute: fixtureRouteSchema,
    verificationState: runtimeVerificationStateSchema,
    unresolvedQuestions: z.array(nonEmptyStringSchema),
    filesInspected: z.array(nonEmptyStringSchema),
    filesChanged: z.array(nonEmptyStringSchema),
    commands: z.array(nonEmptyStringSchema),
    diagnostics: z.array(nonEmptyStringSchema),
    outcome: artifactOutcomeSchema,
    failureReason: nonEmptyStringSchema.optional(),
    cost: z.number().finite().nonnegative().optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    tags: z.array(nonEmptyStringSchema),
    startedAt: isoDatetimeSchema,
    endedAt: isoDatetimeSchema
  })
  .superRefine((value, ctx) => {
    if (value.outcome === 'failure' && value.failureReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'failure task-end events require failureReason',
        path: ['failureReason']
      });
    }

    if (Date.parse(value.endedAt) < Date.parse(value.startedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task-end events require endedAt to be on or after startedAt',
        path: ['endedAt']
      });
    }
  });

export type TaskEndEvent = z.infer<typeof taskEndEventSchema>;

export function parseTaskEndEvent(input: unknown): TaskEndEvent {
  return taskEndEventSchema.parse(input);
}
