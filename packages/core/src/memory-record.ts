import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const memoryScopeSchema = z.enum(['task-local', 'repo-local', 'user-global']);
export const memoryKindSchema = z.enum(['fact', 'instruction', 'preference', 'summary']);
export const memorySourceSchema = z.enum([
  'artifact-analysis',
  'human-input',
  'session-packet',
  'system-inference'
]);
export const memoryConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const memoryRecordSchema = z
  .object({
    id: nonEmptyStringSchema,
    scope: memoryScopeSchema,
    repoId: nonEmptyStringSchema.optional(),
    taskId: nonEmptyStringSchema.optional(),
    kind: memoryKindSchema,
    value: nonEmptyStringSchema,
    source: memorySourceSchema,
    sourceArtifactIds: z.array(nonEmptyStringSchema),
    confidence: memoryConfidenceSchema,
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
    expiresAt: isoDatetimeSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'task-local' && value.taskId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task-local memory requires taskId',
        path: ['taskId']
      });
    }

    if (value.scope === 'repo-local' && value.repoId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'repo-local memory requires repoId',
        path: ['repoId']
      });
    }

    if (value.scope === 'user-global' && (value.repoId !== undefined || value.taskId !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'user-global memory must not include repoId or taskId',
        path: ['scope']
      });
    }
  });

export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

export function parseMemoryRecord(input: unknown): MemoryRecord {
  return memoryRecordSchema.parse(input);
}
