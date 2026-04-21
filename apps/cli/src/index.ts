import { pathToFileURL } from 'node:url';

import { CORE_PACKAGE_NAME } from '@meta-harness/core';

export function renderHelp() {
  return [
    'meta-harness CLI scaffold',
    `Shared runtime package: ${CORE_PACKAGE_NAME}`,
    'Available workspace commands:',
    '  pnpm test',
    '  pnpm build',
    '  pnpm typecheck'
  ].join('\n');
}

export function run(args = process.argv.slice(2), stdout: Pick<typeof console, 'log'> = console) {
  const output = renderHelp();

  if (args.includes('--help') || args.length === 0) {
    stdout.log(output);
  }

  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
