import { join } from 'node:path';

import {
  assertValidPathSegment,
  createCompactionSummary,
  type CompactionSummary,
  type CreateCompactionSummaryInput,
  writeJsonFile
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';

type Output = Pick<typeof console, 'log'>;

type CompactSessionSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  filePath: string;
  summary: CompactionSummary;
};

type CompactSessionFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type CompactSessionResult = CompactSessionSuccess | CompactSessionFailure;

function getCompactionPath(dataRoot: string, repoId: string, taskId: string | undefined): string {
  if (taskId === undefined) {
    throw new Error('compact-session requires taskId for runtime storage');
  }

  return join(
    dataRoot,
    'data',
    'runtime',
    'compaction',
    assertValidPathSegment('repoId', repoId),
    `${assertValidPathSegment('taskId', taskId)}.json`
  );
}

export async function runCompactSessionCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    compact?: (input: CreateCompactionSummaryInput) => CompactionSummary;
    writeJson?: (filePath: string, value: unknown) => Promise<string>;
  } = {}
): Promise<CompactSessionResult> {
  const stderr = options.error ?? console.error;

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('compact-session', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getOption(args, '--data-root') as string;
  const compact = options.compact ?? createCompactionSummary;
  const writeJson = options.writeJson ?? writeJsonFile;

  try {
    const input = await readInputValue(args);
    const summary = compact(JSON.parse(input) as CreateCompactionSummaryInput);
    const filePath = await writeJson(getCompactionPath(dataRoot, summary.repoId, summary.taskId), summary);
    const output = renderJsonOutput(args, { filePath, summary }, () => {
      return `Compacted task ${summary.taskId} (${summary.suggestedRoute}) with ${summary.selectedMemoryIds.length} memory ids and ${summary.selectedArtifactIds.length} artifact ids`;
    });

    emitOutput(stdout, output);

    return {
      success: true,
      exitCode: 0,
      output,
      filePath,
      summary
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('compact-session', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
