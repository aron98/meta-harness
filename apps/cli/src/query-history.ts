import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  parseArtifactRecord,
  parseMemoryRecord,
  parseRetrievalQuery,
  rankArtifacts,
  rankMemories,
  type ArtifactRecord,
  type MemoryRecord,
  type RetrievalQuery,
  type ScoredRetrieval
} from '@meta-harness/core';

type Output = Pick<typeof console, 'log'>;

type LoadedRecords<T> = {
  records: T[];
  warnings: string[];
};

type ReadTextFile = typeof readFile;

export type QueryHistoryInput = RetrievalQuery & {
  limit?: number;
};

type QueryHistorySuccess = {
  success: true;
  exitCode: 0;
  output: string;
  query: RetrievalQuery;
  artifacts: ScoredRetrieval<ArtifactRecord>[];
  memories: ScoredRetrieval<MemoryRecord>[];
  warnings: string[];
};

type QueryHistoryFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type QueryHistoryResult = QueryHistorySuccess | QueryHistoryFailure;

async function listJsonFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nestedFiles = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(root, entry.name);

        if (entry.isDirectory()) {
          return listJsonFiles(entryPath);
        }

        return entry.name.endsWith('.json') ? [entryPath] : [];
      })
    );

    return nestedFiles.flat();
  } catch (caughtError) {
    const error = caughtError as NodeJS.ErrnoException;

    if (error.code === 'ENOENT') {
      return [];
    }

    throw caughtError;
  }
}

async function loadRecordsFromFiles<T>(
  filePaths: readonly string[],
  parseRecord: (input: unknown) => T,
  warningLabel: string,
  options: {
    readTextFile?: ReadTextFile;
  } = {}
): Promise<LoadedRecords<T>> {
  const readTextFile = options.readTextFile ?? readFile;
  const loaded = await Promise.all(
    filePaths.map(async (filePath) => {
      const fileContent = await readTextFile(filePath, 'utf8');

      try {
        return {
          kind: 'record' as const,
          record: parseRecord(JSON.parse(fileContent))
        };
      } catch (caughtError) {
        if (!(caughtError instanceof SyntaxError) && !(caughtError instanceof Error && caughtError.name === 'ZodError')) {
          throw caughtError;
        }

        return {
          kind: 'warning' as const,
          warning: `Warning: skipped ${warningLabel} ${filePath.split('/').at(-1) ?? filePath}`
        };
      }
    })
  );

  return loaded.reduce<LoadedRecords<T>>(
    (result, entry) => {
      if (entry.kind === 'record') {
        result.records.push(entry.record);
      } else {
        result.warnings.push(entry.warning);
      }

      return result;
    },
    { records: [], warnings: [] }
  );
}

export async function listArtifactRecordsFromStore(
  dataRoot: string,
  options: {
    readTextFile?: ReadTextFile;
  } = {}
): Promise<LoadedRecords<ArtifactRecord>> {
  const filePaths = await listJsonFiles(join(dataRoot, 'data/artifacts'));

  return loadRecordsFromFiles(filePaths, parseArtifactRecord, 'artifact record', options);
}

export async function listMemoryRecordsFromStore(
  dataRoot: string,
  options: {
    readTextFile?: ReadTextFile;
  } = {}
): Promise<LoadedRecords<MemoryRecord>> {
  const filePaths = await listJsonFiles(join(dataRoot, 'data/memory'));

  return loadRecordsFromFiles(filePaths, parseMemoryRecord, 'memory record', options);
}

function getRequiredOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function parseQueryHistoryInput(input: string): { query: RetrievalQuery; limit: number } {
  const parsed = JSON.parse(input) as QueryHistoryInput;
  const query = parseRetrievalQuery(parsed);
  const limit = parsed.limit ?? 3;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer');
  }

  return { query, limit };
}

export async function runQueryHistoryCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    listArtifactRecords?: (dataRoot: string) => Promise<LoadedRecords<ArtifactRecord> | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<LoadedRecords<MemoryRecord> | MemoryRecord[]>;
  } = {}
): Promise<QueryHistoryResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getRequiredOption(args, '--data-root');
  const input = getRequiredOption(args, '--input');

  if (dataRoot === undefined || input === undefined || dataRoot.startsWith('--') || input.startsWith('--')) {
    const error = 'query-history failed: missing required --data-root and --input';

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;

  try {
    const { query, limit } = parseQueryHistoryInput(input);
    const [loadedMemories, loadedArtifacts] = await Promise.all([
      listMemoryRecords(dataRoot),
      listArtifactRecords(dataRoot)
    ]);
    const memoryRecords = Array.isArray(loadedMemories) ? loadedMemories : loadedMemories.records;
    const artifactRecords = Array.isArray(loadedArtifacts) ? loadedArtifacts : loadedArtifacts.records;
    const warnings = [
      ...(Array.isArray(loadedMemories) ? [] : loadedMemories.warnings),
      ...(Array.isArray(loadedArtifacts) ? [] : loadedArtifacts.warnings)
    ];
    const memories = rankMemories(query, memoryRecords).slice(0, limit);
    const artifacts = rankArtifacts(query, artifactRecords).slice(0, limit);
    const memorySummary = memories.map((entry) => entry.record.id).join(', ') || 'none';
    const artifactSummary = artifacts.map((entry) => entry.record.id).join(', ') || 'none';
    const output = `memories=${memorySummary}\nartifacts=${artifactSummary}`;

    for (const warning of warnings) {
      stdout.log(warning);
    }

    stdout.log(`Top memories: ${memorySummary}`);
    stdout.log(`Top artifacts: ${artifactSummary}`);

    return {
      success: true,
      exitCode: 0,
      output,
      query,
      artifacts,
      memories,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = `query-history failed: ${message}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
