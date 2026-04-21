import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const taskTypeSchema = z.enum([
  'analysis',
  'codegen',
  'documentation',
  'fix',
  'planning',
  'verification'
]);

export const artifactOutcomeSchema = z.enum(['success', 'failure', 'partial']);

export const artifactRecordSchema = z
  .object({
    id: nonEmptyStringSchema,
    taskType: taskTypeSchema,
    repoId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema.optional(),
    promptSummary: nonEmptyStringSchema,
    filesInspected: z.array(nonEmptyStringSchema),
    filesChanged: z.array(nonEmptyStringSchema),
    commands: z.array(nonEmptyStringSchema),
    diagnostics: z.array(nonEmptyStringSchema),
    verification: z.array(nonEmptyStringSchema),
    outcome: artifactOutcomeSchema,
    failureReason: nonEmptyStringSchema.optional(),
    cost: z.number().finite().nonnegative().optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    tags: z.array(nonEmptyStringSchema),
    createdAt: isoDatetimeSchema
  })
  .superRefine((value, ctx) => {
    if (value.outcome === 'failure' && value.failureReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'failure artifacts require failureReason',
        path: ['failureReason']
      });
    }
  });

export type ArtifactRecord = z.infer<typeof artifactRecordSchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export type ArtifactOutcome = z.infer<typeof artifactOutcomeSchema>;

export function parseArtifactRecord(input: unknown): ArtifactRecord {
  return artifactRecordSchema.parse(input);
}
