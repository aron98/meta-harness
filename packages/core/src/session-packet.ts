import { z } from 'zod';

import { fixtureRouteSchema } from './fixture-authoring-schema';
import { taskTypeSchema } from './artifact-record';

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });

export const sessionPacketSchema = z.object({
  id: nonEmptyStringSchema,
  repoId: nonEmptyStringSchema,
  taskType: taskTypeSchema,
  taskId: nonEmptyStringSchema.optional(),
  selectedMemoryIds: z.array(nonEmptyStringSchema),
  selectedArtifactIds: z.array(nonEmptyStringSchema),
  suggestedRoute: fixtureRouteSchema,
  verificationChecklist: z.array(nonEmptyStringSchema),
  rationale: nonEmptyStringSchema,
  createdAt: isoDatetimeSchema
});

export type SessionPacket = z.infer<typeof sessionPacketSchema>;
export type SessionPacketRoute = z.infer<typeof fixtureRouteSchema>;

export function parseSessionPacket(input: unknown): SessionPacket {
  return sessionPacketSchema.parse(input);
}
