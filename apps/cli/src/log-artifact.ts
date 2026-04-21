import { parseArtifactRecord, writeArtifactRecord, type ArtifactRecord } from '@meta-harness/core';

import { emitOutput, formatCommandError, hasOptionValue, getOption, readInputValue, renderJsonOutput } from './command-io';

type Output = Pick<typeof console, 'log'>;

type LogArtifactSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  filePath: string;
  record: ArtifactRecord;
  recordId: string;
};

type LogArtifactFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type LogArtifactResult = LogArtifactSuccess | LogArtifactFailure;

export async function runLogArtifactCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    parseArtifact?: (input: unknown) => ArtifactRecord;
    writeArtifact?: (dataRoot: string, record: ArtifactRecord) => Promise<string>;
  } = {}
): Promise<LogArtifactResult> {
  const stderr = options.error ?? console.error;

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('log-artifact', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getOption(args, '--data-root') as string;
  const parseArtifact = options.parseArtifact ?? parseArtifactRecord;
  const writeArtifact = options.writeArtifact ?? writeArtifactRecord;

  try {
    const input = await readInputValue(args);
    const record = parseArtifact(JSON.parse(input));
    const filePath = await writeArtifact(dataRoot, record);
    const output = renderJsonOutput(
      args,
      { recordId: record.id, filePath, record },
      () => `Logged artifact ${record.id} (${record.outcome})`
    );

    emitOutput(stdout, output);

    return {
      success: true,
      exitCode: 0,
      output,
      filePath,
      record,
      recordId: record.id
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('log-artifact', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
