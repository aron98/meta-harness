import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import { writeJsonFile } from '../write-json-file';
import { parseCandidate, type CandidatePolicy } from './candidate';
import { getCandidateManifestPath, getCandidateSelectionPath } from './candidate-paths';

const selectionSchema = z
  .object({
    runId: z.string().trim().min(1),
    candidateId: z.string().trim().min(1)
  })
  .passthrough();

export type ExportCandidatePolicyInput = {
  dataRoot: string;
  runId: string;
  outputFile: string;
};

export type ExportedCandidatePolicyArtifact = {
  runId: string;
  candidateId: string;
  policy: CandidatePolicy;
};

export type ExportCandidatePolicyResult = {
  runId: string;
  candidateId: string;
  outputFile: string;
};

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function exportCandidatePolicy(input: ExportCandidatePolicyInput): Promise<ExportCandidatePolicyResult> {
  const selection = selectionSchema.parse(await readJsonFile(getCandidateSelectionPath(input.dataRoot, input.runId)));
  const candidate = parseCandidate(await readJsonFile(getCandidateManifestPath(input.dataRoot, input.runId, selection.candidateId)));
  const artifact: ExportedCandidatePolicyArtifact = {
    runId: input.runId,
    candidateId: candidate.id,
    policy: candidate.policy
  };

  await writeJsonFile(input.outputFile, artifact);

  return {
    runId: input.runId,
    candidateId: candidate.id,
    outputFile: input.outputFile
  };
}
