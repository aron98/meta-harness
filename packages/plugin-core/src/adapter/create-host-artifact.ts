import {
  createTaskEndArtifact,
  type ArtifactRecord,
  type CreateTaskEndArtifactInput
} from '@meta-harness/core';

export type CreateHostArtifactInput = CreateTaskEndArtifactInput;
export type CreateHostArtifactResult = ArtifactRecord;

export function createHostArtifact(input: CreateHostArtifactInput): CreateHostArtifactResult {
  return createTaskEndArtifact(input);
}
