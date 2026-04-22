import {
  inspectRetrieval,
  parseRetrievalQuery,
  rankArtifacts,
  rankMemories,
  type ArtifactRecord,
  type InspectRetrievalInput,
  type MemoryRecord,
  type RetrievalInspection,
  type RetrievalQuery,
  type ScoredRetrieval
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';
import { listArtifactRecordsFromStore, listMemoryRecordsFromStore } from './query-history';

type Output = Pick<typeof console, 'log'>;

type LoadedRecords<T> = {
  records: T[];
  warnings: string[];
};

type InspectRetrievalCommandInput = RetrievalQuery & {
  maxMemories?: number;
  maxArtifacts?: number;
};

type InspectRetrievalSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  query: RetrievalQuery;
  inspection: RetrievalInspection;
  warnings: string[];
};

type InspectRetrievalFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type InspectRetrievalResult = InspectRetrievalSuccess | InspectRetrievalFailure;

function parseInspectRetrievalInput(input: string): InspectRetrievalCommandInput {
  const parsed = JSON.parse(input) as InspectRetrievalCommandInput;

  if (parsed.maxMemories !== undefined && (!Number.isInteger(parsed.maxMemories) || parsed.maxMemories < 0)) {
    throw new Error('maxMemories must be a non-negative integer');
  }

  if (parsed.maxArtifacts !== undefined && (!Number.isInteger(parsed.maxArtifacts) || parsed.maxArtifacts < 0)) {
    throw new Error('maxArtifacts must be a non-negative integer');
  }

  return parsed;
}

function renderSelectedRecord<T extends MemoryRecord | ArtifactRecord>(prefix: string, entry: ScoredRetrieval<T>): string {
  return `- ${entry.record.id} score=${entry.score} reasons=${entry.reasons.join(', ') || 'none'} (${prefix})`;
}

export async function runInspectRetrievalCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    listArtifactRecords?: (dataRoot: string) => Promise<LoadedRecords<ArtifactRecord> | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<LoadedRecords<MemoryRecord> | MemoryRecord[]>;
    inspect?: (input: InspectRetrievalInput) => RetrievalInspection;
  } = {}
): Promise<InspectRetrievalResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getOption(args, '--data-root');

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('inspect-retrieval', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const resolvedDataRoot = dataRoot as string;
  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const inspect = options.inspect ?? inspectRetrieval;

  try {
    const input = await readInputValue(args);
    const parsedInput = parseInspectRetrievalInput(input);
    const query = parseRetrievalQuery(parsedInput);
    const [loadedMemories, loadedArtifacts] = await Promise.all([
      listMemoryRecords(resolvedDataRoot),
      listArtifactRecords(resolvedDataRoot)
    ]);
    const memoryRecords = Array.isArray(loadedMemories) ? loadedMemories : loadedMemories.records;
    const artifactRecords = Array.isArray(loadedArtifacts) ? loadedArtifacts : loadedArtifacts.records;
    const warnings = [
      ...(Array.isArray(loadedMemories) ? [] : loadedMemories.warnings),
      ...(Array.isArray(loadedArtifacts) ? [] : loadedArtifacts.warnings)
    ];
    const inspection = inspect({
      rankedMemories: rankMemories(query, memoryRecords),
      rankedArtifacts: rankArtifacts(query, artifactRecords),
      maxMemories: parsedInput.maxMemories,
      maxArtifacts: parsedInput.maxArtifacts
    });
    const humanLines = [
      'Selected memories:',
      ...(inspection.selectedMemories.length === 0
        ? ['- none']
        : inspection.selectedMemories.map((entry) => renderSelectedRecord('memory', entry))),
      'Selected artifacts:',
      ...(inspection.selectedArtifacts.length === 0
        ? ['- none']
        : inspection.selectedArtifacts.map((entry) => renderSelectedRecord('artifact', entry)))
    ];
    const output = renderJsonOutput(args, { query, inspection, warnings }, () => humanLines.join('\n'));

    if (hasFlag(args, '--json')) {
      emitOutput(stdout, output);
    } else {
      for (const warning of warnings) {
        stdout.log(warning);
      }

      for (const line of humanLines) {
        stdout.log(line);
      }
    }

    return {
      success: true,
      exitCode: 0,
      output,
      query,
      inspection,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('inspect-retrieval', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
