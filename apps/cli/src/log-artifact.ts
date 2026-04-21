import { parseArtifactRecord, writeArtifactRecord, type ArtifactRecord } from '@meta-harness/core';

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

function getRequiredOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function getMissingRequiredFlags(args: readonly string[]): string[] {
  return ['--data-root', '--input'].filter((flag) => {
    const value = getRequiredOption(args, flag);

    return value === undefined || value.startsWith('--');
  });
}

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
  const missingFlags = getMissingRequiredFlags(args);

  if (missingFlags.length > 0) {
    const error = `log-artifact failed: missing required ${missingFlags.join(' and ')}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getRequiredOption(args, '--data-root') as string;
  const input = getRequiredOption(args, '--input') as string;
  const parseArtifact = options.parseArtifact ?? parseArtifactRecord;
  const writeArtifact = options.writeArtifact ?? writeArtifactRecord;

  try {
    const record = parseArtifact(JSON.parse(input));
    const filePath = await writeArtifact(dataRoot, record);
    const output = `Logged artifact ${record.id} (${record.outcome})`;

    stdout.log(output);

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
    const error = `log-artifact failed: ${message}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
