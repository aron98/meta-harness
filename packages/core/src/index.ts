import { z } from 'zod';

export {
  fixtureIdSchema,
  fixtureAuthoringSchema,
  fixtureRouteSchema,
  parseFixtureAuthoringSchema,
  repoMaturitySchema,
  type FixtureAuthoringRecord
} from './fixture-authoring-schema';

export {
  artifactOutcomeSchema,
  artifactRecordSchema,
  parseArtifactRecord,
  taskTypeSchema,
  type ArtifactOutcome,
  type ArtifactRecord,
  type TaskType
} from './artifact-record';
export { compactionSummarySchema, parseCompactionSummary, type CompactionSummary } from './compaction-summary';
export {
  COMPACTION_SUMMARY_LIMITS,
  createCompactionSummary,
  type CreateCompactionSummaryInput
} from './create-compaction-summary';
export { loadArtifactRecord, writeArtifactRecord } from './artifact-store';
export { canonicalFixtureSchema, type CanonicalFixture } from './canonical-fixture-schema';
export {
  createTaskEndArtifact,
  type CreateTaskEndArtifactInput
} from './create-task-end-artifact';
export {
  createTaskStartContext,
  type CreateTaskStartContextInput,
  type CreateTaskStartContextResult
} from './create-task-start-context';
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
export {
  parseRuntimeTaskContext,
  runtimeTaskContextSchema,
  type RuntimeTaskContext
} from './runtime-task-context';
export { canonicalFixtureJsonSchema, fixtureAuthoringJsonSchema } from './schema-documents';
export { renderFixtureSummary } from './render-fixture-summary';
export { parseSessionPacket, sessionPacketSchema, type SessionPacket } from './session-packet';
export {
  prepareSessionPacket,
  type PrepareSessionPacketInput,
  type PrepareSessionPacketPolicyInput,
  type PrepareSessionPacketRetrievalPolicyInput,
  type PrepareSessionPacketRoutingPolicyInput,
  type PrepareSessionPacketVerificationPolicyInput
} from './prepare-session-packet';
export {
  evaluatePacketBenchmarks,
  type EvaluatePacketBenchmark,
  type EvaluatePacketBenchmarkResult,
  type EvaluatePacketBenchmarksInput,
  type EvaluatePacketBenchmarksResult,
  type EvaluatePacketMetrics
} from './evaluate-packet';
export { retrievalQuerySchema, parseRetrievalQuery, type RetrievalQuery } from './retrieval-query';
export {
  inspectRetrieval,
  type InspectRetrievalInput,
  type RetrievalInspection
} from './inspect-retrieval';
export { rankArtifacts, rankMemories, type RetrievalReason, type ScoredRetrieval } from './retriever';
export { parseTaskEndEvent, taskEndEventSchema, type TaskEndEvent } from './task-end-event';
export {
  parseTaskStartEvent,
  runtimeVerificationStateSchema,
  runtimeVerificationStatusSchema,
  taskStartEventSchema,
  type RuntimeVerificationState,
  type RuntimeVerificationStatus,
  type TaskStartEvent
} from './task-start-event';
export { classifyTaskType } from './task-classification';
export { buildVerificationChecklist, type VerificationChecklistInput } from './verification-checklist';
export { type SessionPacketRoute } from './session-packet';
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
