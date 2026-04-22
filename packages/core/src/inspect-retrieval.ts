import type { ArtifactRecord } from './artifact-record';
import type { MemoryRecord } from './memory-record';
import type { ScoredRetrieval } from './retriever';

export type InspectRetrievalInput = {
  rankedMemories: readonly ScoredRetrieval<MemoryRecord>[];
  rankedArtifacts: readonly ScoredRetrieval<ArtifactRecord>[];
  maxMemories?: number;
  maxArtifacts?: number;
};

export type RetrievalInspection = {
  selectedMemories: ScoredRetrieval<MemoryRecord>[];
  selectedArtifacts: ScoredRetrieval<ArtifactRecord>[];
};

function clampCount(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

export function inspectRetrieval(input: InspectRetrievalInput): RetrievalInspection {
  const maxMemories = clampCount(input.maxMemories, input.rankedMemories.length);
  const maxArtifacts = clampCount(input.maxArtifacts, input.rankedArtifacts.length);

  return {
    selectedMemories: input.rankedMemories.slice(0, maxMemories).map((entry) => ({ ...entry, reasons: [...entry.reasons] })),
    selectedArtifacts: input.rankedArtifacts.slice(0, maxArtifacts).map((entry) => ({ ...entry, reasons: [...entry.reasons] }))
  };
}
