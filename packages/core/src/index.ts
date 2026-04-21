import { z } from 'zod';

export {
  fixtureAuthoringSchema,
  parseFixtureAuthoringSchema,
  type FixtureAuthoringRecord
} from './fixture-authoring-schema';

export {
  artifactOutcomeSchema,
  artifactRecordSchema,
  parseArtifactRecord,
  taskTypeSchema,
  type ArtifactRecord
} from './artifact-record';
export { loadArtifactRecord, writeArtifactRecord } from './artifact-store';
export { canonicalFixtureSchema, type CanonicalFixture } from './canonical-fixture-schema';
export {
  memoryConfidenceSchema,
  memoryKindSchema,
  memoryRecordSchema,
  memoryScopeSchema,
  memorySourceSchema,
  parseMemoryRecord,
  type MemoryRecord
} from './memory-record';
export { loadMemoryRecord, writeMemoryRecord } from './memory-store';
export { normalizeFixture } from './normalize-fixture';
export { canonicalFixtureJsonSchema, fixtureAuthoringJsonSchema } from './schema-documents';
export { renderFixtureSummary } from './render-fixture-summary';
export { parseSessionPacket, sessionPacketSchema, type SessionPacket } from './session-packet';
export { assertValidPathSegment, getArtifactRecordPath, getMemoryRecordPath, type MemoryRecordLocator } from './storage-paths';
export { writeJsonFile } from './write-json-file';

export const CORE_PACKAGE_NAME = '@meta-harness/core';

const harnessMetadataSchema = z.object({
  phase: z.enum(['phase-0', 'phase-1', 'phase-2', 'phase-3']).default('phase-0'),
  project: z.string().min(1)
});

export type HarnessMetadata = z.infer<typeof harnessMetadataSchema>;

export function parseHarnessMetadata(input: unknown): HarnessMetadata {
  return harnessMetadataSchema.parse(input);
}
