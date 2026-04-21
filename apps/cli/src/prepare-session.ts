import { prepareSessionPacket, type ArtifactRecord, type MemoryRecord, type PrepareSessionPacketInput, type SessionPacket } from '@meta-harness/core';

import { emitOutput, formatCommandError, getOption, hasFlag, hasOptionValue, readInputValue, renderJsonOutput } from './command-io';
import { listArtifactRecordsFromStore, listMemoryRecordsFromStore } from './query-history';

type Output = Pick<typeof console, 'log'>;

type PrepareSessionSuccess = {
  success: true;
  exitCode: 0;
  output: string;
  packet: SessionPacket;
  warnings: string[];
};

type PrepareSessionFailure = {
  success: false;
  exitCode: 1;
  output: string;
  error: string;
};

export type PrepareSessionResult = PrepareSessionSuccess | PrepareSessionFailure;

export async function runPrepareSessionCommand(
  args: readonly string[],
  stdout: Output = console,
  options: {
    error?: typeof console.error;
    listArtifactRecords?: (dataRoot: string) => Promise<{ records: ArtifactRecord[]; warnings: string[] } | ArtifactRecord[]>;
    listMemoryRecords?: (dataRoot: string) => Promise<{ records: MemoryRecord[]; warnings: string[] } | MemoryRecord[]>;
    preparePacket?: (input: PrepareSessionPacketInput) => SessionPacket;
  } = {}
): Promise<PrepareSessionResult> {
  const stderr = options.error ?? console.error;
  const dataRoot = getOption(args, '--data-root');

  if (!hasOptionValue(args, '--data-root') || (!hasOptionValue(args, '--input') && !hasOptionValue(args, '--input-file'))) {
    const error = formatCommandError('prepare-session', 'missing required --data-root and one of --input or --input-file');

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const resolvedDataRoot = dataRoot as string;

  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const preparePacket = options.preparePacket ?? prepareSessionPacket;

  try {
    const input = await readInputValue(args);
    const parsedInput = JSON.parse(input) as Omit<PrepareSessionPacketInput, 'artifactRecords' | 'memoryRecords'>;
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
    const packet = preparePacket({
      ...parsedInput,
      memoryRecords,
      artifactRecords
    });
    const output = renderJsonOutput(args, { packet, warnings }, () => JSON.stringify(packet));

    if (hasFlag(args, '--json')) {
      emitOutput(stdout, output);
    } else {
      for (const warning of warnings) {
        stdout.log(warning);
      }

      stdout.log(`Prepared session packet ${packet.id} (${packet.taskType}/${packet.suggestedRoute})`);
      stdout.log(`Selected ${packet.selectedMemoryIds.length} memories and ${packet.selectedArtifactIds.length} artifacts`);
    }

    return {
      success: true,
      exitCode: 0,
      output,
      packet,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = formatCommandError('prepare-session', message);

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
