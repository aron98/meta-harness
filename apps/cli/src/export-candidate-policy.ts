import {
  exportCandidatePolicy,
  type ExportCandidatePolicyResult
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue } from './command-io';

type Output = Pick<typeof console, 'log'>;

type ExportCandidatePolicyCommandSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  runId: string;
  candidateId: string;
  outputFile: string;
};

type ExportCandidatePolicyCommandFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type ExportCandidatePolicyCommandResult =
  | ExportCandidatePolicyCommandSuccess
  | ExportCandidatePolicyCommandFailure;

function renderHumanPayload(result: ExportCandidatePolicyResult): string {
  return [
    `Exported candidate policy for run ${result.runId}`,
    `Winner: ${result.candidateId}`,
    `Output: ${result.outputFile}`
  ].join('\n');
}

export async function runExportCandidatePolicyCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    exportPolicy?: typeof exportCandidatePolicy;
  } = {}
): Promise<ExportCandidatePolicyCommandResult> {
  const stderr = options.error ?? console.error;

  if (!hasOptionValue(args, '--data-root') || !hasOptionValue(args, '--run-id') || !hasOptionValue(args, '--output-file')) {
    const error = formatCommandError('export-candidate-policy', 'missing required --data-root, --run-id, and --output-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const exportPolicy = options.exportPolicy ?? exportCandidatePolicy;

  try {
    const result = await exportPolicy({
      dataRoot: getOption(args, '--data-root') as string,
      runId: getOption(args, '--run-id') as string,
      outputFile: getOption(args, '--output-file') as string
    });
    const output = hasFlag(args, '--json') ? JSON.stringify(result) : renderHumanPayload(result);

    if (hasFlag(args, '--json')) {
      emitOutput(stdout, output);
    } else {
      for (const line of output.split('\n')) {
        stdout.log(line);
      }
    }

    return {
      success: true,
      exitCode: 0,
      output,
      runId: result.runId,
      candidateId: result.candidateId,
      outputFile: result.outputFile
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('export-candidate-policy', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
