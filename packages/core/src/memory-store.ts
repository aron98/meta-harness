import { readFile } from 'node:fs/promises';

import { parseMemoryRecord, type MemoryRecord } from './memory-record';
import { getMemoryRecordPath, type MemoryRecordLocator } from './storage-paths';
import { writeJsonFile } from './write-json-file';

export async function writeMemoryRecord(dataRoot: string, record: MemoryRecord): Promise<string> {
  const parsedRecord = parseMemoryRecord(record);

  return writeJsonFile(getMemoryRecordPath(dataRoot, parsedRecord), parsedRecord);
}

export async function loadMemoryRecord(dataRoot: string, locator: MemoryRecordLocator): Promise<MemoryRecord> {
  const fileContent = await readFile(getMemoryRecordPath(dataRoot, locator), 'utf8');

  return parseMemoryRecord(JSON.parse(fileContent));
}
