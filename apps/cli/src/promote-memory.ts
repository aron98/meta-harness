import { parseMemoryRecord, writeMemoryRecord, type MemoryRecord } from '@meta-harness/core';

type Output = Pick<typeof console, 'log'>;

type PromoteMemorySuccess = {
  success: true;
  exitCode: 0;
  output: string;
  filePath: string;
  memory: MemoryRecord;
  memoryId: string;
};

type PromoteMemoryFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type PromoteMemoryResult = PromoteMemorySuccess | PromoteMemoryFailure;

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

export async function runPromoteMemoryCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    parseMemory?: (input: unknown) => MemoryRecord;
    writeMemory?: (dataRoot: string, record: MemoryRecord) => Promise<string>;
  } = {}
): Promise<PromoteMemoryResult> {
  const stderr = options.error ?? console.error;
  const missingFlags = getMissingRequiredFlags(args);

  if (missingFlags.length > 0) {
    const error = `promote-memory failed: missing required ${missingFlags.join(' and ')}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getRequiredOption(args, '--data-root') as string;
  const input = getRequiredOption(args, '--input') as string;
  const parseMemory = options.parseMemory ?? parseMemoryRecord;
  const writeMemory = options.writeMemory ?? writeMemoryRecord;

  try {
    const memory = parseMemory(JSON.parse(input));
    const filePath = await writeMemory(dataRoot, memory);
    const output = `Promoted memory ${memory.id} (${memory.scope})`;

    stdout.log(output);

    return {
      success: true,
      exitCode: 0,
      output,
      filePath,
      memory,
      memoryId: memory.id
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = `promote-memory failed: ${message}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
