import {
  createTaskStartContext,
  type ArtifactRecord,
  type CreateTaskStartContextInput,
  type CreateTaskStartContextResult,
  type MemoryRecord
} from '@meta-harness/core';

import type { AdapterPolicyInput } from './adapter-policy-input';
import type { AdapterPolicySourceScope } from './adapter-observability';
import type { AdapterPolicyIdentity, AdapterRuntimeRoots } from './host-adapter-contract';

export type AdapterSelectedRecordSource = {
  id: string;
  sourceScope: AdapterPolicySourceScope;
};

export type CreateHostSessionMetadata = {
  runtimeRoots?: AdapterRuntimeRoots;
  selectedMemorySources: AdapterSelectedRecordSource[];
  selectedArtifactSources: AdapterSelectedRecordSource[];
  policyIdentity?: AdapterPolicyIdentity;
};

type CreateHostSessionBaseInput = Omit<CreateTaskStartContextInput, 'memoryRecords' | 'artifactRecords'>;

type CreateHostSessionPolicyInput = {
  policyInput?: AdapterPolicyInput;
};

type ScopedMemoryRecordsInput =
  | { userMemoryRecords: readonly MemoryRecord[]; projectMemoryRecords?: readonly MemoryRecord[] }
  | { userMemoryRecords?: readonly MemoryRecord[]; projectMemoryRecords: readonly MemoryRecord[] };

type ScopedArtifactRecordsInput =
  | { userArtifactRecords: readonly ArtifactRecord[]; projectArtifactRecords?: readonly ArtifactRecord[] }
  | { userArtifactRecords?: readonly ArtifactRecord[]; projectArtifactRecords: readonly ArtifactRecord[] };

export type CreateHostSessionLegacyInput = CreateHostSessionBaseInput &
  CreateHostSessionPolicyInput & {
    memoryRecords: readonly MemoryRecord[];
    artifactRecords: readonly ArtifactRecord[];
    runtimeRoots?: never;
    userMemoryRecords?: never;
    projectMemoryRecords?: never;
    userArtifactRecords?: never;
    projectArtifactRecords?: never;
    policyIdentity?: never;
  };

export type CreateHostSessionRuntimeInput = CreateHostSessionBaseInput &
  CreateHostSessionPolicyInput &
  ScopedMemoryRecordsInput &
  ScopedArtifactRecordsInput & {
  runtimeRoots?: AdapterRuntimeRoots;
  memoryRecords?: readonly MemoryRecord[];
  artifactRecords?: readonly ArtifactRecord[];
  policyIdentity?: AdapterPolicyIdentity;
};

export type CreateHostSessionInput = CreateHostSessionLegacyInput | CreateHostSessionRuntimeInput;

export type CreateHostSessionResult = CreateTaskStartContextResult & {
  adapterMetadata?: CreateHostSessionMetadata;
};

export function createHostSession(input: CreateHostSessionInput): CreateHostSessionResult {
  if (!hasAdapterRuntimeInput(input)) {
    return createTaskStartContext(input);
  }

  const memoryRecords = mergeScopedRecords(input.projectMemoryRecords, input.userMemoryRecords, input.memoryRecords);
  const artifactRecords = mergeScopedRecords(input.projectArtifactRecords, input.userArtifactRecords, input.artifactRecords);
  const sourceScopeByMemoryId = buildRecordSourceScopeMap(input.projectMemoryRecords, input.userMemoryRecords);
  const sourceScopeByArtifactId = buildRecordSourceScopeMap(input.projectArtifactRecords, input.userArtifactRecords);
  const result = createTaskStartContext({
    ...input,
    memoryRecords,
    artifactRecords
  });

  return {
    ...result,
    adapterMetadata: {
      runtimeRoots: input.runtimeRoots,
      selectedMemorySources: selectRecordSources(result.taskStart.selectedMemoryIds, sourceScopeByMemoryId),
      selectedArtifactSources: selectRecordSources(result.taskStart.selectedArtifactIds, sourceScopeByArtifactId),
      policyIdentity: input.policyIdentity
    }
  };
}

function hasAdapterRuntimeInput(input: CreateHostSessionInput): input is CreateHostSessionRuntimeInput {
  return (
    input.runtimeRoots !== undefined ||
    input.userMemoryRecords !== undefined ||
    input.projectMemoryRecords !== undefined ||
    input.userArtifactRecords !== undefined ||
    input.projectArtifactRecords !== undefined ||
    input.policyIdentity !== undefined
  );
}

function mergeScopedRecords<T extends { id: string }>(
  projectRecords: readonly T[] | undefined,
  userRecords: readonly T[] | undefined,
  fallbackRecords: readonly T[] | undefined
): T[] {
  const records: T[] = [];
  const seenIds = new Set<string>();

  for (const record of [...(projectRecords ?? []), ...(userRecords ?? []), ...(fallbackRecords ?? [])]) {
    if (!seenIds.has(record.id)) {
      records.push(record);
      seenIds.add(record.id);
    }
  }

  return records;
}

function buildRecordSourceScopeMap<T extends { id: string }>(
  projectRecords: readonly T[] | undefined,
  userRecords: readonly T[] | undefined
): Map<string, AdapterPolicySourceScope> {
  const sourceScopeById = new Map<string, AdapterPolicySourceScope>();

  for (const record of projectRecords ?? []) {
    sourceScopeById.set(record.id, 'project');
  }

  for (const record of userRecords ?? []) {
    if (!sourceScopeById.has(record.id)) {
      sourceScopeById.set(record.id, 'user');
    }
  }

  return sourceScopeById;
}

function selectRecordSources(
  selectedIds: readonly string[],
  sourceScopeById: ReadonlyMap<string, AdapterPolicySourceScope>
): AdapterSelectedRecordSource[] {
  return selectedIds.flatMap((id) => {
    const sourceScope = sourceScopeById.get(id);

    return sourceScope === undefined ? [] : [{ id, sourceScope }];
  });
}
