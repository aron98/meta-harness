import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { benchmarkFixtures } from '@meta-harness/fixtures';
import {
  getCandidateSelectionPath,
  isoDatetimeSchema,
  parseCandidate,
  parseCandidateBenchmarkFixtures,
  parseCandidateMutation,
  parseCandidateSearchConfig,
  parseCandidateObjectiveConfig,
  runCandidateSearch,
  validateHeldOutCandidate,
  type ArtifactRecord,
  type Candidate,
  type CandidateBenchmarkFixture,
  type CandidateEvaluationResult,
  type CandidateMutation,
  type CandidateObjectiveConfigInput,
  type CandidateSearchConfigInput,
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
  fixturesFile?: string;
  candidatesFile?: string;
  mutationsFile?: string;
  searchConfigFile?: string;
  objectiveFile?: string;
};

type LoadedCandidateSearchConfig = {
  fixtures?: CandidateBenchmarkFixture[];
  candidates?: Candidate[];
  mutations?: CandidateMutation[];
  searchConfig?: CandidateSearchConfigInput;
  objectiveConfig?: CandidateObjectiveConfigInput;
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

function parseNonNegativeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || typeof value !== 'number' || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  return value;
}

function parseOptionalFilePath(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
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

  if (referenceTime !== undefined && (typeof referenceTime !== 'string' || !isoDatetimeSchema.safeParse(referenceTime).success)) {
    throw new Error('referenceTime must be an ISO datetime string');
  }

  return {
    runId,
    referenceTime,
    maxMemories: parseNonNegativeInteger(parsed.maxMemories, 'maxMemories'),
    maxArtifacts: parseNonNegativeInteger(parsed.maxArtifacts, 'maxArtifacts'),
    fixturesFile: parseOptionalFilePath(parsed.fixturesFile, 'fixturesFile'),
    candidatesFile: parseOptionalFilePath(parsed.candidatesFile, 'candidatesFile'),
    mutationsFile: parseOptionalFilePath(parsed.mutationsFile, 'mutationsFile'),
    searchConfigFile: parseOptionalFilePath(parsed.searchConfigFile, 'searchConfigFile'),
    objectiveFile: parseOptionalFilePath(parsed.objectiveFile, 'objectiveFile')
  };
}

async function loadJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(filePath), 'utf8'));
}

async function loadCandidateSearchConfigFiles(input: CandidateSearchCommandInput): Promise<LoadedCandidateSearchConfig> {
  const loaded: LoadedCandidateSearchConfig = {};

  if (input.mutationsFile !== undefined && input.searchConfigFile !== undefined) {
    throw new Error('provide either mutationsFile or searchConfigFile, not both');
  }

  if (input.fixturesFile !== undefined) {
    loaded.fixtures = parseCandidateBenchmarkFixtures(await loadJsonFile(input.fixturesFile));
  }

  if (input.candidatesFile !== undefined) {
    const candidates = await loadJsonFile(input.candidatesFile);

    if (!Array.isArray(candidates)) {
      throw new Error('candidatesFile must contain a JSON array');
    }

    loaded.candidates = candidates.map(parseCandidate);
  }

  if (input.mutationsFile !== undefined) {
    const mutations = await loadJsonFile(input.mutationsFile);

    if (!Array.isArray(mutations)) {
      throw new Error('mutationsFile must contain a JSON array');
    }

    loaded.mutations = mutations.map(parseCandidateMutation);
  }

  if (input.searchConfigFile !== undefined) {
    loaded.searchConfig = parseCandidateSearchConfig(await loadJsonFile(input.searchConfigFile));
  }

  if (input.objectiveFile !== undefined) {
    loaded.objectiveConfig = parseCandidateObjectiveConfig(await loadJsonFile(input.objectiveFile));
  }

  return loaded;
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
    const loadedConfig = await loadCandidateSearchConfigFiles(input);
    const fixtures = loadedConfig.fixtures ?? options.benchmarkFixtures ?? benchmarkFixtures;
    const searchConfig = loadedConfig.searchConfig ?? (loadedConfig.mutations === undefined ? undefined : { mutations: loadedConfig.mutations });
    const searchInput = {
      dataRoot: resolvedDataRoot,
      runId: input.runId,
      fixtures,
      memoryRecords,
      artifactRecords,
      referenceTime,
      maxMemories: input.maxMemories,
      maxArtifacts: input.maxArtifacts,
      ...(loadedConfig.candidates === undefined ? {} : { candidates: loadedConfig.candidates }),
      ...(searchConfig === undefined ? {} : { searchConfig }),
      ...(loadedConfig.objectiveConfig === undefined ? {} : { objectiveConfig: loadedConfig.objectiveConfig })
    };
    const search = await runSearch(searchInput);
    const heldOutInput = {
      dataRoot: resolvedDataRoot,
      runId: input.runId,
      candidate: search.winner.candidate,
      fixtures,
      memoryRecords,
      artifactRecords,
      referenceTime,
      maxMemories: input.maxMemories,
      maxArtifacts: input.maxArtifacts,
      selection: search.winner,
      ...(loadedConfig.objectiveConfig === undefined ? {} : { objectiveConfig: loadedConfig.objectiveConfig })
    };
    const heldOut = await validateHeldOut(heldOutInput);
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
