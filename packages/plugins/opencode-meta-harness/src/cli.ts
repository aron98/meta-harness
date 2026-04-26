import { pathToFileURL } from 'node:url'

import { inspectOpenCodeMetaHarnessHealth, renderHealthReport } from './doctor'
import { installOpenCodeMetaHarness, type VersionProvider } from './install'
import { renderUpgradeReport, upgradeOpenCodeMetaHarness } from './upgrade'

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
  packageVersionProvider?: VersionProvider
  latestVersionProvider?: VersionProvider
}

export function renderHelp() {
  return [
    '@meta-harness/opencode-meta-harness CLI',
    '',
    'Usage:',
    '  npx @meta-harness/opencode-meta-harness install [--dry-run]',
    '  npx @meta-harness/opencode-meta-harness doctor',
    '  npx @meta-harness/opencode-meta-harness upgrade [--dry-run]',
    '',
    'Commands:',
    '  install  Patch global OpenCode config with the meta-harness plugin tuple',
    '  doctor   Inspect OpenCode config, data root, package versions, and update status',
    '  upgrade  Update OpenCode config to an explicit newer plugin version when available',
    '',
    'Options:',
    '  --dry-run     Show target paths/changes without writing config or data directories',
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

  const command = args[0]

  if (command === 'install') {
    return runInstall(args, stdout, stderr, options)
  }

  if (command === 'doctor') {
    return runDoctor(args, stdout, stderr, options)
  }

  if (command === 'upgrade') {
    return runUpgrade(args, stdout, stderr, options)
  }

  {
    const error = `Unknown command: ${args[0]}\n\n${renderHelp()}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }
}

async function runInstall(
  args: string[],
  stdout: Output,
  stderr: ErrorOutput,
  options: RunOptions
): Promise<RunResult> {
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
      dryRun: args.includes('--dry-run'),
      packageVersionProvider: options.packageVersionProvider,
      latestVersionProvider: options.latestVersionProvider
    })
    const verb = result.dryRun ? 'Would install' : 'Installed'
    const lines = [
      `${verb} @meta-harness/opencode-meta-harness`,
      `OpenCode config: ${result.configPath}`,
      `Data root: ${result.dataRoot}`,
      `Config changed: ${result.changed ? 'yes' : 'no'}`,
      `Already installed: ${result.alreadyInstalled ? 'yes' : 'no'}`,
      `Plugin configured: ${result.configured ? 'yes' : 'no'}`
    ]

    if (result.updateAvailable && result.latestVersion) {
      lines.push(`Update available: ${result.latestVersion}`)
      lines.push('Run: npx @meta-harness/opencode-meta-harness upgrade')
    }

    const output = lines.join('\n')

    stdout.log(output)
    return { success: true, exitCode: 0, output }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    const error = `opencode-meta-harness install failed: ${message}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }
}

async function runDoctor(
  args: string[],
  stdout: Output,
  stderr: ErrorOutput,
  options: RunOptions
): Promise<RunResult> {
  const unsupported = args.slice(1)
  if (unsupported.length > 0) {
    const error = `Unknown doctor option: ${unsupported[0]}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }

  try {
    const health = await inspectOpenCodeMetaHarnessHealth({
      cwd: options.cwd,
      home: options.home,
      env: options.env,
      packageVersionProvider: options.packageVersionProvider,
      latestVersionProvider: options.latestVersionProvider
    })
    const output = renderHealthReport(health)
    stdout.log(output)
    return { success: true, exitCode: 0, output }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    const error = `opencode-meta-harness doctor failed: ${message}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }
}

async function runUpgrade(
  args: string[],
  stdout: Output,
  stderr: ErrorOutput,
  options: RunOptions
): Promise<RunResult> {
  const unsupported = args.slice(1).filter((arg) => arg !== '--dry-run')
  if (unsupported.length > 0) {
    const error = `Unknown upgrade option: ${unsupported[0]}`
    stderr(error)
    return { success: false, exitCode: 1, output: error, error }
  }

  try {
    const result = await upgradeOpenCodeMetaHarness({
      cwd: options.cwd,
      home: options.home,
      env: options.env,
      dryRun: args.includes('--dry-run'),
      packageVersionProvider: options.packageVersionProvider,
      latestVersionProvider: options.latestVersionProvider
    })
    const output = renderUpgradeReport(result)
    stdout.log(output)
    return { success: true, exitCode: 0, output }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    const error = `opencode-meta-harness upgrade failed: ${message}`
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
