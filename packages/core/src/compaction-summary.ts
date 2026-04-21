import { z } from 'zod';

import { fixtureRouteSchema } from './fixture-authoring-schema';
import { runtimeVerificationStateSchema } from './task-start-event';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const compactionSummarySchema = z
  .object({
    repoId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema.optional(),
    taskText: nonEmptyStringSchema,
    selectedMemoryIds: z.array(nonEmptyStringSchema),
    selectedArtifactIds: z.array(nonEmptyStringSchema),
    suggestedRoute: fixtureRouteSchema,
    verificationState: runtimeVerificationStateSchema,
    unresolvedQuestions: z.array(nonEmptyStringSchema),
    compactedAt: isoDatetimeSchema,
    startedAt: isoDatetimeSchema,
    endedAt: isoDatetimeSchema
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.endedAt) < Date.parse(value.startedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'compaction summaries require endedAt to be on or after startedAt',
        path: ['endedAt']
      });
    }

    if (Date.parse(value.compactedAt) < Date.parse(value.endedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'compaction summaries require compactedAt to be on or after endedAt',
        path: ['compactedAt']
      });
    }
  });

export type CompactionSummary = z.infer<typeof compactionSummarySchema>;

export function parseCompactionSummary(input: unknown): CompactionSummary {
  return compactionSummarySchema.parse(input);
}
