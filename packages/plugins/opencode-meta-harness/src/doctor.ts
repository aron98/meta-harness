import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  computeConfiguredUpdateStatus,
  findConfiguredPackageSpec,
  hasTargetPlugin,
  readConfig,
  resolveConfigPath,
  resolveDataRoot,
  resolveLatestVersion,
  resolvePackageVersion,
  type VersionProvider
} from './install'

export type UpdateStatus = 'up-to-date' | 'update-available' | 'unknown'

export type HealthCheckOptions = {
  cwd?: string
  home?: string
  env?: Record<string, string | undefined>
  packageVersionProvider?: VersionProvider
  latestVersionProvider?: VersionProvider
}

export type OpenCodeMetaHarnessHealth = {
  configPath: string
  dataRoot: string
  configExists: boolean
  configParses: boolean
  configParseError?: string
  pluginConfigured: boolean
  configuredPackageSpec?: string
  dataRootExists: boolean
  currentVersion?: string
  latestVersion?: string
  updateStatus: UpdateStatus
}

export async function inspectOpenCodeMetaHarnessHealth(
  options: HealthCheckOptions = {}
): Promise<OpenCodeMetaHarnessHealth> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const home = resolve(options.home ?? process.env.HOME ?? cwd)
  const env = options.env ?? process.env
  const configPath = resolveConfigPath({ home, env })
  const dataRoot = resolveDataRoot({ home, env })
  const currentVersion = await resolvePackageVersion(options.packageVersionProvider)
  const latestVersion = await resolveLatestVersion(options.latestVersionProvider)
  const base = {
    configPath,
    dataRoot,
    dataRootExists: await pathExists(dataRoot),
    currentVersion,
    latestVersion
  }

  try {
    const existingConfig = await readConfig(configPath)
    const configuredPackageSpec = findConfiguredPackageSpec(existingConfig.config)
    return {
      ...base,
      configExists: existingConfig.source !== undefined,
      configParses: true,
      pluginConfigured: hasTargetPlugin(existingConfig.config),
      configuredPackageSpec,
      updateStatus: computeUpdateStatus(configuredPackageSpec, currentVersion, latestVersion)
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    if (!message.startsWith('Could not parse OpenCode config')) {
      throw caughtError
    }

    return {
      ...base,
      configExists: true,
      configParses: false,
      configParseError: message,
      pluginConfigured: false,
      configuredPackageSpec: undefined,
      dataRootExists: base.dataRootExists,
      updateStatus: 'unknown'
    }
  }
}

export function renderHealthReport(health: OpenCodeMetaHarnessHealth): string {
  return [
    'OpenCode meta-harness doctor',
    `OpenCode config: ${health.configPath}`,
    `Data root: ${health.dataRoot}`,
    `Config exists: ${health.configExists ? 'yes' : 'no'}`,
    `Config parses: ${health.configParses ? 'yes' : 'no'}`,
    `Plugin configured: ${health.pluginConfigured ? 'yes' : 'no'}`,
    `Configured package spec: ${health.configuredPackageSpec ?? 'unknown'}`,
    `Data root exists: ${health.dataRootExists ? 'yes' : 'no'}`,
    `Current package version: ${health.currentVersion ?? 'unknown'}`,
    `Latest npm version: ${health.latestVersion ?? 'unknown'}`,
    `Update status: ${formatUpdateStatus(health.updateStatus)}`
  ].join('\n')
}

export function computeUpdateStatus(
  configuredPackageSpec: string | undefined,
  currentVersion: string | undefined,
  latestVersion: string | undefined
): UpdateStatus {
  const configuredStatus = computeConfiguredUpdateStatus(configuredPackageSpec, latestVersion)
  if (configuredStatus !== 'unknown') {
    return configuredStatus
  }

  if (currentVersion === undefined || latestVersion === undefined) {
    return 'unknown'
  }

  return 'unknown'
}

export function formatUpdateStatus(status: UpdateStatus): string {
  if (status === 'update-available') {
    return 'update available'
  }

  if (status === 'up-to-date') {
    return 'up to date'
  }

  return 'unknown'
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      return false
    }

    throw caughtError
  }
}
