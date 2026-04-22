import { pathToFileURL } from 'node:url';

import { formatCommandError } from './command-io';

type Output = Pick<typeof console, 'log'>;
type BuildFixtureArtifacts = typeof import('./build-fixture-artifacts').buildFixtureArtifacts;
type CompactSession = typeof import('./compact-session').runCompactSessionCommand;
type EvaluatePacket = typeof import('./evaluate-packet').runEvaluatePacketCommand;
type InspectRetrieval = typeof import('./inspect-retrieval').runInspectRetrievalCommand;
type LogArtifact = typeof import('./log-artifact').runLogArtifactCommand;
type PromoteMemory = typeof import('./promote-memory').runPromoteMemoryCommand;
type QueryHistory = typeof import('./query-history').runQueryHistoryCommand;
type PrepareSession = typeof import('./prepare-session').runPrepareSessionCommand;
type TaskEnd = typeof import('./task-end').runTaskEndCommand;
type TaskStart = typeof import('./task-start').runTaskStartCommand;

const CORE_PACKAGE_NAME = '@meta-harness/core';

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
    '  task-start              Build and persist prepared runtime task context',
    '  task-end                Capture runtime task completion and artifact output',
    '  inspect-retrieval       Show selected records, scores, and reasons',
    '  compact-session         Persist a typed bounded session summary',
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
      compactSession?: CompactSession;
      evaluatePacket?: EvaluatePacket;
      inspectRetrieval?: InspectRetrieval;
      logArtifact?: LogArtifact;
      promoteMemory?: PromoteMemory;
      queryHistory?: QueryHistory;
      prepareSession?: PrepareSession;
      taskEnd?: TaskEnd;
      taskStart?: TaskStart;
  } = {}
): Promise<RunResult> {
  const help = renderHelp();
  const stderr = options.error ?? console.error;

  if (args.includes('--help') || args.length === 0) {
    stdout.log(help);
    return { success: true, exitCode: 0, output: help };
  }

  if (args[0] === 'build-fixture-artifacts') {
    try {
      const buildArtifacts = options.buildFixtureArtifacts ?? (await import('./build-fixture-artifacts')).buildFixtureArtifacts;
      const result = await buildArtifacts();

      stdout.log('Wrote files:');
      for (const file of result.writtenFiles) {
        stdout.log(`- ${file}`);
      }

      return { success: true, exitCode: 0, output: result.writtenFiles.join('\n') };
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      const error = formatCommandError('build-fixture-artifacts', message);

      stderr(error);
      return { success: false, exitCode: 1, output: error, error };
    }
  }

  if (args[0] === 'log-artifact') {
    const logArtifact = options.logArtifact ?? (await import('./log-artifact')).runLogArtifactCommand;
    return logArtifact(args.slice(1), stdout, options);
  }

  if (args[0] === 'promote-memory') {
    const promoteMemory = options.promoteMemory ?? (await import('./promote-memory')).runPromoteMemoryCommand;
    return promoteMemory(args.slice(1), stdout, options);
  }

  if (args[0] === 'task-start') {
    const taskStart = options.taskStart ?? (await import('./task-start')).runTaskStartCommand;
    return taskStart(args.slice(1), stdout, options);
  }

  if (args[0] === 'task-end') {
    const taskEnd = options.taskEnd ?? (await import('./task-end')).runTaskEndCommand;
    return taskEnd(args.slice(1), stdout, options);
  }

  if (args[0] === 'inspect-retrieval') {
    const inspectRetrieval = options.inspectRetrieval ?? (await import('./inspect-retrieval')).runInspectRetrievalCommand;
    return inspectRetrieval(args.slice(1), stdout, options);
  }

  if (args[0] === 'compact-session') {
    const compactSession = options.compactSession ?? (await import('./compact-session')).runCompactSessionCommand;
    return compactSession(args.slice(1), stdout, options);
  }

  if (args[0] === 'query-history') {
    const queryHistory = options.queryHistory ?? (await import('./query-history')).runQueryHistoryCommand;
    return queryHistory(args.slice(1), stdout, options);
  }

  if (args[0] === 'prepare-session') {
    const prepareSession = options.prepareSession ?? (await import('./prepare-session')).runPrepareSessionCommand;
    return prepareSession(args.slice(1), stdout, options);
  }

  if (args[0] === 'evaluate-packet') {
    const evaluatePacket = options.evaluatePacket ?? (await import('./evaluate-packet')).runEvaluatePacketCommand;
    return evaluatePacket(args.slice(1), stdout, options);
  }

  const error = formatCommandError('cli', `unknown command ${args[0]}`);
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
