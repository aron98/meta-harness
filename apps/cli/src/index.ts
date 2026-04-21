import { pathToFileURL } from 'node:url';

import { CORE_PACKAGE_NAME } from '@meta-harness/core';

import { buildFixtureArtifacts } from './build-fixture-artifacts';
import { runEvaluatePacketCommand } from './evaluate-packet';
import { runLogArtifactCommand } from './log-artifact';
import { runPrepareSessionCommand } from './prepare-session';
import { runPromoteMemoryCommand } from './promote-memory';
import { runQueryHistoryCommand } from './query-history';

type Output = Pick<typeof console, 'log'>;
type BuildFixtureArtifacts = typeof buildFixtureArtifacts;
type EvaluatePacket = typeof runEvaluatePacketCommand;
type LogArtifact = typeof runLogArtifactCommand;
type PromoteMemory = typeof runPromoteMemoryCommand;
type QueryHistory = typeof runQueryHistoryCommand;
type PrepareSession = typeof runPrepareSessionCommand;

export type RunResult =
  | { success: true; exitCode: 0; output: string }
  | { success: false; exitCode: 1; output: string; error: string };

export function renderHelp() {
  return [
    'meta-harness CLI scaffold',
    `Shared runtime package: ${CORE_PACKAGE_NAME}`,
    'Available commands:',
    '  build-fixture-artifacts  Write generated fixture artifacts to docs/generated',
    '  log-artifact             Validate and store an artifact record',
    '  promote-memory          Validate and store a memory record',
    '  query-history           Rank stored memory and artifact history',
    '  prepare-session         Build a session packet from stored history',
    '  evaluate-packet         Compare packet retrieval-on versus retrieval-off',
    '',
    'Available workspace commands:',
    '  pnpm test',
    '  pnpm build',
    '  pnpm typecheck'
  ].join('\n');
}

export async function run(
  args = process.argv.slice(2),
  stdout: Output = console,
  options: {
      error?: typeof console.error;
      buildFixtureArtifacts?: BuildFixtureArtifacts;
      evaluatePacket?: EvaluatePacket;
      logArtifact?: LogArtifact;
      promoteMemory?: PromoteMemory;
      queryHistory?: QueryHistory;
    prepareSession?: PrepareSession;
  } = {}
): Promise<RunResult> {
  const help = renderHelp();
  const stderr = options.error ?? console.error;
  const buildArtifacts = options.buildFixtureArtifacts ?? buildFixtureArtifacts;
  const evaluatePacket = options.evaluatePacket ?? runEvaluatePacketCommand;
  const logArtifact = options.logArtifact ?? runLogArtifactCommand;
  const promoteMemory = options.promoteMemory ?? runPromoteMemoryCommand;
  const queryHistory = options.queryHistory ?? runQueryHistoryCommand;
  const prepareSession = options.prepareSession ?? runPrepareSessionCommand;

  if (args.includes('--help') || args.length === 0) {
    stdout.log(help);
    return { success: true, exitCode: 0, output: help };
  }

  if (args[0] === 'build-fixture-artifacts') {
    try {
      const result = await buildArtifacts();

      stdout.log('Wrote files:');
      for (const file of result.writtenFiles) {
        stdout.log(`- ${file}`);
      }

      return { success: true, exitCode: 0, output: result.writtenFiles.join('\n') };
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      const error = `build-fixture-artifacts failed: ${message}`;

      stderr(error);
      return { success: false, exitCode: 1, output: error, error };
    }
  }

  if (args[0] === 'log-artifact') {
    return logArtifact(args.slice(1), stdout, options);
  }

  if (args[0] === 'promote-memory') {
    return promoteMemory(args.slice(1), stdout, options);
  }

  if (args[0] === 'query-history') {
    return queryHistory(args.slice(1), stdout, options);
  }

  if (args[0] === 'prepare-session') {
    return prepareSession(args.slice(1), stdout, options);
  }

  if (args[0] === 'evaluate-packet') {
    return evaluatePacket(args.slice(1), stdout, options);
  }

  const error = `Unknown command: ${args[0]}`;
  stderr(error);
  stdout.log(help);
  return { success: false, exitCode: 1, output: help, error };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().then((result) => {
    if (!result.success) {
      process.exitCode = result.exitCode;
    }
  });
}
