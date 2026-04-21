import { z } from 'zod';

export {
  fixtureAuthoringSchema,
  parseFixtureAuthoringSchema,
  type FixtureAuthoringRecord
} from './fixture-authoring-schema';

export const CORE_PACKAGE_NAME = '@meta-harness/core';

const harnessMetadataSchema = z.object({
  phase: z.enum(['phase-0', 'phase-1', 'phase-2', 'phase-3']).default('phase-0'),
  project: z.string().min(1)
});

export type HarnessMetadata = z.infer<typeof harnessMetadataSchema>;

export function parseHarnessMetadata(input: unknown): HarnessMetadata {
  return harnessMetadataSchema.parse(input);
}
