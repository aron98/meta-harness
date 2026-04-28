import { benchmarkFixtures } from '@meta-harness/fixtures';
import {
  getCandidateSelectionPath,
  runCandidateSearch,
  validateHeldOutCandidate,
  type ArtifactRecord,
  type CandidateBenchmarkFixture,
  type CandidateEvaluationResult,
  type CandidateSearchResult,
  type MemoryRecord
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue } from './command-io';
import { listArtifactRecordsFromStore, listMemoryRecordsFromStore } from './query-history';

type Output = Pick<typeof console, 'log'>;

type LoadedRecords<T> = {
  records: T[];
  warnings: string[];
};

export type CandidateSearchCommandInput = {
  runId: string;
  referenceTime?: string;
  maxMemories?: number;
  maxArtifacts?: number;
};

type CandidateSearchCommandPayload = {
  search: CandidateSearchResult;
  heldOut: CandidateEvaluationResult;
  warnings: string[];
  paths: {
    selection: string;
  };
};

type CandidateSearchCommandSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  search: CandidateSearchResult;
  heldOut: CandidateEvaluationResult;
  warnings: string[];
  paths: {
    selection: string;
  };
};

type CandidateSearchCommandFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type CandidateSearchCommandResult = CandidateSearchCommandSuccess | CandidateSearchCommandFailure;

function normalizeLoadedRecords<T>(loaded: LoadedRecords<T> | T[]): LoadedRecords<T> {
  return Array.isArray(loaded) ? { records: loaded, warnings: [] } : loaded;
}

function parsePositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || typeof value !== 'number' || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function parseCandidateSearchCommandInput(input: string): CandidateSearchCommandInput {
  const parsed = JSON.parse(input) as Record<string, unknown>;
  const runId = parsed.runId;
  const referenceTime = parsed.referenceTime;

  if (typeof runId !== 'string' || runId.trim().length === 0) {
    throw new Error('runId must be a non-empty string');
  }

  if (referenceTime !== undefined && (typeof referenceTime !== 'string' || Number.isNaN(Date.parse(referenceTime)))) {
    throw new Error('referenceTime must be an ISO datetime string');
  }

  return {
    runId,
    referenceTime,
    maxMemories: parsePositiveInteger(parsed.maxMemories, 'maxMemories'),
    maxArtifacts: parsePositiveInteger(parsed.maxArtifacts, 'maxArtifacts')
  };
}

function renderHumanPayload(payload: CandidateSearchCommandPayload): string {
  return [
    `Candidate search run ${payload.search.runId}`,
    `Winner: ${payload.search.winner.candidateId} (score ${payload.search.winner.summary.score})`,
    `Train fixtures: ${payload.search.trainFixtureCount}`,
    `Held-out fixtures: ${payload.search.heldOutFixtureCount}`,
    `Held-out score: ${payload.heldOut.summary.score}`,
    `Selection: ${payload.paths.selection}`
  ].join('\n');
}

export async function runCandidateSearchCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    benchmarkFixtures?: readonly CandidateBenchmarkFixture[];
    listArtifactRecords?: (dataRoot: string) => Promise<LoadedRecords<ArtifactRecord> | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<LoadedRecords<MemoryRecord> | MemoryRecord[]>;
    runSearch?: typeof runCandidateSearch;
    validateHeldOut?: typeof validateHeldOutCandidate;
    now?: () => string;
  } = {}
): Promise<CandidateSearchCommandResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getOption(args, '--data-root');

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('run-candidate-search', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const resolvedDataRoot = dataRoot as string;
  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const runSearch = options.runSearch ?? runCandidateSearch;
  const validateHeldOut = options.validateHeldOut ?? validateHeldOutCandidate;
  const now = options.now ?? (() => new Date().toISOString());

  try {
    const input = parseCandidateSearchCommandInput(await readInputValue(args));
    const referenceTime = input.referenceTime ?? now();
    const [loadedMemoriesRaw, loadedArtifactsRaw] = await Promise.all([
      listMemoryRecords(resolvedDataRoot),
      listArtifactRecords(resolvedDataRoot)
    ]);
    const loadedMemories = normalizeLoadedRecords(loadedMemoriesRaw);
    const loadedArtifacts = normalizeLoadedRecords(loadedArtifactsRaw);
    const memoryRecords = loadedMemories.records;
    const artifactRecords = loadedArtifacts.records;
    const warnings = [...loadedMemories.warnings, ...loadedArtifacts.warnings];
    const fixtures = options.benchmarkFixtures ?? benchmarkFixtures;
    const search = await runSearch({
      dataRoot: resolvedDataRoot,
      runId: input.runId,
      fixtures,
      memoryRecords,
      artifactRecords,
      referenceTime,
      maxMemories: input.maxMemories,
      maxArtifacts: input.maxArtifacts
    });
    const heldOut = await validateHeldOut({
      dataRoot: resolvedDataRoot,
      runId: input.runId,
      candidate: search.winner.candidate,
      fixtures,
      memoryRecords,
      artifactRecords,
      referenceTime,
      maxMemories: input.maxMemories,
      maxArtifacts: input.maxArtifacts,
      selection: search.winner
    });
    const paths = {
      selection: getCandidateSelectionPath(resolvedDataRoot, input.runId)
    };
    const payload = { search, heldOut, warnings, paths };
    const output = hasFlag(args, '--json') ? JSON.stringify(payload) : renderHumanPayload(payload);

    if (hasFlag(args, '--json')) {
      emitOutput(stdout, output);
    } else {
      for (const warning of warnings) {
        stdout.log(warning);
      }

      for (const line of output.split('\n')) {
        stdout.log(line);
      }
    }

    return {
      success: true,
      exitCode: 0,
      output,
      search,
      heldOut,
      warnings,
      paths
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('run-candidate-search', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
