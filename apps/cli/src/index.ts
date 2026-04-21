import { pathToFileURL } from 'node:url';

import { CORE_PACKAGE_NAME } from '@meta-harness/core';

import { buildFixtureArtifacts } from './build-first-slice';

type Output = Pick<typeof console, 'log'>;
type BuildFixtureArtifacts = typeof buildFixtureArtifacts;

export type RunResult =
  | { success: true; exitCode: 0; output: string }
  | { success: false; exitCode: 1; output: string; error: string };

export function renderHelp() {
  return [
    'meta-harness CLI scaffold',
    `Shared runtime package: ${CORE_PACKAGE_NAME}`,
    'Available commands:',
    '  build-fixture-artifacts  Write generated fixture artifacts to docs/generated',
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
  } = {}
): Promise<RunResult> {
  const help = renderHelp();
  const stderr = options.error ?? console.error;
  const buildArtifacts = options.buildFixtureArtifacts ?? buildFixtureArtifacts;

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
