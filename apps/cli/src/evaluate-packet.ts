import { benchmarkFixtures } from '@meta-harness/fixtures';
import {
  evaluatePacketBenchmarks,
  type ArtifactRecord,
  type EvaluatePacketBenchmark,
  type EvaluatePacketBenchmarksResult,
  type MemoryRecord
} from '@meta-harness/core';

import { listArtifactRecordsFromStore, listMemoryRecordsFromStore } from './query-history';

type Output = Pick<typeof console, 'log'>;

type EvaluatePacketSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  evaluation: EvaluatePacketBenchmarksResult;
  warnings: string[];
};

type EvaluatePacketFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type EvaluatePacketResult = EvaluatePacketSuccess | EvaluatePacketFailure;

function getRequiredOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

export async function runEvaluatePacketCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    benchmarkFixtures?: readonly EvaluatePacketBenchmark[];
    evaluateBenchmarks?: typeof evaluatePacketBenchmarks;
    listArtifactRecords?: (dataRoot: string) => Promise<{ records: ArtifactRecord[]; warnings: string[] } | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<{ records: MemoryRecord[]; warnings: string[] } | MemoryRecord[]>;
    now?: () => string;
  } = {}
): Promise<EvaluatePacketResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getRequiredOption(args, '--data-root');

  if (dataRoot === undefined || dataRoot.startsWith('--')) {
    const error = 'evaluate-packet failed: missing required --data-root';

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const evaluateBenchmarks = options.evaluateBenchmarks ?? evaluatePacketBenchmarks;
  const now = options.now ?? (() => new Date().toISOString());

  try {
    const [loadedMemories, loadedArtifacts] = await Promise.all([listMemoryRecords(dataRoot), listArtifactRecords(dataRoot)]);
    const memoryRecords = Array.isArray(loadedMemories) ? loadedMemories : loadedMemories.records;
    const artifactRecords = Array.isArray(loadedArtifacts) ? loadedArtifacts : loadedArtifacts.records;
    const warnings = [
      ...(Array.isArray(loadedMemories) ? [] : loadedMemories.warnings),
      ...(Array.isArray(loadedArtifacts) ? [] : loadedArtifacts.warnings)
    ];
    const evaluation = evaluateBenchmarks({
      benchmarks: options.benchmarkFixtures ?? benchmarkFixtures,
      memoryRecords,
      artifactRecords,
      referenceTime: now()
    });
    const output = JSON.stringify(evaluation);

    for (const warning of warnings) {
      stdout.log(warning);
    }

    stdout.log(`Evaluated ${evaluation.summary.benchmarkCount} benchmark packet(s)`);
    stdout.log(output);

    return {
      success: true,
      exitCode: 0,
      output,
      evaluation,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = `evaluate-packet failed: ${message}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
