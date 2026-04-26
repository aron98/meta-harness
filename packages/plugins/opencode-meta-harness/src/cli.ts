import { pathToFileURL } from 'node:url'

import { installOpenCodeMetaHarness } from './install'

type Output = Pick<typeof console, 'log'>
type ErrorOutput = typeof console.error

export type RunResult =
  | { success: true; exitCode: 0; output: string }
  | { success: false; exitCode: 1; output: string; error: string }

export type RunOptions = {
  error?: ErrorOutput
  cwd?: string
  home?: string
  env?: Record<string, string | undefined>
}

export function renderHelp() {
  return [
    '@meta-harness/opencode-meta-harness CLI',
    '',
    'Usage:',
    '  npx @meta-harness/opencode-meta-harness install [--dry-run]',
    '',
    'Commands:',
    '  install  Patch global OpenCode config with the meta-harness plugin tuple',
    '',
    'Options:',
    '  --dry-run     Show target paths without writing config or data directories',
    '  -h, --help    Show this help'
  ].join('\n')
}

export async function run(
  args = process.argv.slice(2),
  stdout: Output = console,
  options: RunOptions = {}
): Promise<RunResult> {
  const stderr = options.error ?? console.error

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    const help = renderHelp()
    stdout.log(help)
    return { success: true, exitCode: 0, output: help }
  }

  if (args[0] !== 'install') {
    const error = `Unknown command: ${args[0]}\n\n${renderHelp()}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }

  const unsupported = args.slice(1).filter((arg) => arg !== '--dry-run')
  if (unsupported.length > 0) {
    const error = `Unknown install option: ${unsupported[0]}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }

  try {
    const result = await installOpenCodeMetaHarness({
      cwd: options.cwd,
      home: options.home,
      env: options.env,
      dryRun: args.includes('--dry-run')
    })
    const verb = result.dryRun ? 'Would install' : 'Installed'
    const output = [
      `${verb} @meta-harness/opencode-meta-harness`,
      `OpenCode config: ${result.configPath}`,
      `Data root: ${result.dataRoot}`,
      `Config changed: ${result.changed ? 'yes' : 'no'}`
    ].join('\n')

    stdout.log(output)
    return { success: true, exitCode: 0, output }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    const error = `opencode-meta-harness install failed: ${message}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().then((result) => {
    if (!result.success) {
      process.exitCode = result.exitCode
    }
  })
}
