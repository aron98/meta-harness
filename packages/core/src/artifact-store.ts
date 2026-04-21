import { readFile } from 'node:fs/promises';

import { parseArtifactRecord, type ArtifactRecord } from './artifact-record';
import { getArtifactRecordPath } from './storage-paths';
import { writeJsonFile } from './write-json-file';

export async function writeArtifactRecord(dataRoot: string, record: ArtifactRecord): Promise<string> {
  const parsedRecord = parseArtifactRecord(record);

  return writeJsonFile(getArtifactRecordPath(dataRoot, parsedRecord.repoId, parsedRecord.id), parsedRecord);
}

export async function loadArtifactRecord(
  dataRoot: string,
  repoId: string,
  artifactId: string
): Promise<ArtifactRecord> {
  const fileContent = await readFile(getArtifactRecordPath(dataRoot, repoId, artifactId), 'utf8');

  return parseArtifactRecord(JSON.parse(fileContent));
}
