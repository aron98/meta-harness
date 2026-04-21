import { z } from 'zod';

import { artifactOutcomeSchema, taskTypeSchema } from './artifact-record';

const nonEmptyStringSchema = z.string().trim().min(1);

export const retrievalQuerySchema = z.object({
  repoId: nonEmptyStringSchema,
  taskType: taskTypeSchema,
  tags: z.array(nonEmptyStringSchema).default([]),
  preferredOutcome: artifactOutcomeSchema.optional(),
  referenceTime: z.string().datetime({ offset: true }).optional()
});

export type RetrievalQuery = z.infer<typeof retrievalQuerySchema>;

export function parseRetrievalQuery(input: unknown): RetrievalQuery {
  return retrievalQuerySchema.parse(input);
}
