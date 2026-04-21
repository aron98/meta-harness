import { prepareSessionPacket, type ArtifactRecord, type MemoryRecord, type PrepareSessionPacketInput, type SessionPacket } from '@meta-harness/core';

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

function getRequiredOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

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
  const dataRoot = getRequiredOption(args, '--data-root');
  const input = getRequiredOption(args, '--input');

  if (dataRoot === undefined || input === undefined || dataRoot.startsWith('--') || input.startsWith('--')) {
    const error = 'prepare-session failed: missing required --data-root and --input';

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }

  const listArtifactRecords = options.listArtifactRecords ?? listArtifactRecordsFromStore;
  const listMemoryRecords = options.listMemoryRecords ?? listMemoryRecordsFromStore;
  const preparePacket = options.preparePacket ?? prepareSessionPacket;

  try {
    const parsedInput = JSON.parse(input) as Omit<PrepareSessionPacketInput, 'artifactRecords' | 'memoryRecords'>;
    const [loadedMemories, loadedArtifacts] = await Promise.all([
      listMemoryRecords(dataRoot),
      listArtifactRecords(dataRoot)
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
    const output = JSON.stringify(packet);

    for (const warning of warnings) {
      stdout.log(warning);
    }

    stdout.log(`Prepared session packet ${packet.id} (${packet.taskType}/${packet.suggestedRoute})`);
    stdout.log(`Selected ${packet.selectedMemoryIds.length} memories and ${packet.selectedArtifactIds.length} artifacts`);

    return {
      success: true,
      exitCode: 0,
      output,
      packet,
      warnings
    };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    const error = `prepare-session failed: ${message}`;

    stderr(error);
    return { success: false, exitCode: 1, output: error, error };
  }
}
