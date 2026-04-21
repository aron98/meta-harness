import { parseMemoryRecord, writeMemoryRecord, type MemoryRecord } from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';

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

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('promote-memory', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getOption(args, '--data-root') as string;
  const parseMemory = options.parseMemory ?? parseMemoryRecord;
  const writeMemory = options.writeMemory ?? writeMemoryRecord;

  try {
    const input = await readInputValue(args);
    const memory = parseMemory(JSON.parse(input));
    const filePath = await writeMemory(dataRoot, memory);
    const output = renderJsonOutput(
      args,
      { memoryId: memory.id, filePath, memory },
      () => `Promoted memory ${memory.id} (${memory.scope})`
    );

    emitOutput(stdout, output);

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
    const error = formatCommandError('promote-memory', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
