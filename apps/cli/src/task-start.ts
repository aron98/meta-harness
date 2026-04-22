import { join } from 'node:path';

import {
  assertValidPathSegment,
  createTaskStartContext,
  type ArtifactRecord,
  type CreateTaskStartContextInput,
  type MemoryRecord,
  writeJsonFile
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';
import { listArtifactRecordsFromStore, listMemoryRecordsFromStore } from './query-history';

type Output = Pick<typeof console, 'log'>;

type LoadedRecords<T> = {
  records: T[];
  warnings: string[];
};

type TaskStartCommandInput = Omit<CreateTaskStartContextInput, 'artifactRecords' | 'memoryRecords'>;

type TaskStartSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  filePath: string;
  taskStart: ReturnType<typeof createTaskStartContext>['taskStart'];
  context: ReturnType<typeof createTaskStartContext>['context'];
  warnings: string[];
};

type TaskStartFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type TaskStartResult = TaskStartSuccess | TaskStartFailure;

function getTaskStartPath(dataRoot: string, repoId: string, taskId: string | undefined): string {
  if (taskId === undefined) {
    throw new Error('task-start requires taskId for runtime storage');
  }

  return join(
    dataRoot,
    'data',
    'runtime',
    'task-start',
    assertValidPathSegment('repoId', repoId),
    `${assertValidPathSegment('taskId', taskId)}.json`
  );
}

export async function runTaskStartCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    listArtifactRecords?: (dataRoot: string) => Promise<LoadedRecords<ArtifactRecord> | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<LoadedRecords<MemoryRecord> | MemoryRecord[]>;
    createContext?: (input: CreateTaskStartContextInput) => ReturnType<typeof createTaskStartContext>;
    writeJson?: (filePath: string, value: unknown) => Promise<string>;
  } = {}
): Promise<TaskStartResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getOption(args, '--data-root');

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('task-start', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const resolvedDataRoot = dataRoot as string;
  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const createContext = options.createContext ?? createTaskStartContext;
  const writeJson = options.writeJson ?? writeJsonFile;

  try {
    const input = await readInputValue(args);
    const parsedInput = JSON.parse(input) as TaskStartCommandInput;
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
    const { taskStart, context } = createContext({
      ...parsedInput,
      memoryRecords,
      artifactRecords
    });
    const filePath = await writeJson(getTaskStartPath(resolvedDataRoot, context.repoId, context.taskId), context);
    const output = renderJsonOutput(args, { filePath, taskStart, context, warnings }, () => {
      return [
        `Prepared runtime context ${context.packet.id} for task ${context.taskId} (${context.packet.taskType}/${context.packet.suggestedRoute})`,
        `Selected ${context.packet.selectedMemoryIds.length} memories and ${context.packet.selectedArtifactIds.length} artifacts`
      ].join('\n');
    });

    if (hasFlag(args, '--json')) {
      emitOutput(stdout, output);
    } else {
      for (const warning of warnings) {
        stdout.log(warning);
      }

      stdout.log(`Prepared runtime context ${context.packet.id} for task ${context.taskId} (${context.packet.taskType}/${context.packet.suggestedRoute})`);
      stdout.log(`Selected ${context.packet.selectedMemoryIds.length} memories and ${context.packet.selectedArtifactIds.length} artifacts`);
    }

    return {
      success: true,
      exitCode: 0,
      output,
      filePath,
      taskStart,
      context,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('task-start', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
