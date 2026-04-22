import { join } from 'node:path';

import {
  assertValidPathSegment,
  createTaskEndArtifact,
  parseTaskEndEvent,
  type ArtifactRecord,
  type TaskEndEvent,
  writeArtifactRecord,
  writeJsonFile
} from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';

type Output = Pick<typeof console, 'log'>;

type TaskEndSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  eventFilePath: string;
  artifactFilePath: string;
  event: TaskEndEvent;
  record: ArtifactRecord;
};

type TaskEndFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type TaskEndResult = TaskEndSuccess | TaskEndFailure;

function getTaskEndPath(dataRoot: string, repoId: string, taskId: string | undefined): string {
  if (taskId === undefined) {
    throw new Error('task-end requires taskId for runtime storage');
  }

  return join(
    dataRoot,
    'data',
    'runtime',
    'task-end',
    assertValidPathSegment('repoId', repoId),
    `${assertValidPathSegment('taskId', taskId)}.json`
  );
}

export async function runTaskEndCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    parseEvent?: (input: unknown) => TaskEndEvent;
    createArtifact?: (input: TaskEndEvent) => ArtifactRecord;
    writeArtifact?: (dataRoot: string, record: ArtifactRecord) => Promise<string>;
    writeJson?: (filePath: string, value: unknown) => Promise<string>;
  } = {}
): Promise<TaskEndResult> {
  const stderr = options.error ?? console.error;

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('task-end', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const dataRoot = getOption(args, '--data-root') as string;
  const parseEvent = options.parseEvent ?? parseTaskEndEvent;
  const createArtifact = options.createArtifact ?? createTaskEndArtifact;
  const writeArtifact = options.writeArtifact ?? writeArtifactRecord;
  const writeJson = options.writeJson ?? writeJsonFile;

  try {
    const input = await readInputValue(args);
    const event = parseEvent(JSON.parse(input));
    const record = createArtifact(event);
    const eventFilePath = await writeJson(getTaskEndPath(dataRoot, event.repoId, event.taskId), event);
    const artifactFilePath = await writeArtifact(dataRoot, record);
    const output = renderJsonOutput(args, { eventFilePath, artifactFilePath, event, record }, () => {
      return `Captured task end ${event.id} as artifact ${record.id} (${record.outcome})`;
    });

    emitOutput(stdout, output);

    return {
      success: true,
      exitCode: 0,
      output,
      eventFilePath,
      artifactFilePath,
      event,
      record
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('task-end', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
