import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import { parseAdapterRuntimePolicyArtifact } from '@meta-harness/plugin-core'

import {
  computeConfiguredUpdateStatus,
  findConfiguredPackageSpec,
  hasTargetPlugin,
  isJsonObject,
  readConfig,
  resolveConfigPath,
  resolveDataRoot,
  resolveLatestVersion,
  resolvePackageVersion,
  targetPluginOptions,
  type VersionProvider
} from './install'

export type UpdateStatus = 'up-to-date' | 'update-available' | 'unknown'
export type PolicyArtifactOptionName = 'userPolicyArtifactFile' | 'policyArtifactFile'
export type PolicyArtifactStatus = 'not-configured' | 'ok' | 'missing' | 'malformed'

export type PolicyArtifactHealth = {
  optionName: PolicyArtifactOptionName
  path?: string
  status: PolicyArtifactStatus
  error?: string
}

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
  policyArtifacts: PolicyArtifactHealth[]
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
    const policyArtifacts = await inspectPolicyArtifacts(existingConfig.config, cwd, home)
    return {
      ...base,
      configExists: existingConfig.source !== undefined,
      configParses: true,
      pluginConfigured: hasTargetPlugin(existingConfig.config),
      configuredPackageSpec,
      updateStatus: computeUpdateStatus(configuredPackageSpec, currentVersion, latestVersion),
      policyArtifacts
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
      updateStatus: 'unknown',
      policyArtifacts: notConfiguredPolicyArtifacts()
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
    ...health.policyArtifacts.map(formatPolicyArtifactHealth),
    `Current package version: ${health.currentVersion ?? 'unknown'}`,
    `Latest npm version: ${health.latestVersion ?? 'unknown'}`,
    `Update status: ${formatUpdateStatus(health.updateStatus)}`
  ].join('\n')
}

async function inspectPolicyArtifacts(config: unknown, cwd: string, home: string): Promise<PolicyArtifactHealth[]> {
  const targetOptions = configuredTargetOptions(config)
  if (targetOptions === undefined) {
    return notConfiguredPolicyArtifacts()
  }

  return Promise.all([
    inspectPolicyArtifact('userPolicyArtifactFile', targetOptions.userPolicyArtifactFile, cwd, home),
    inspectPolicyArtifact('policyArtifactFile', targetOptions.policyArtifactFile, cwd, undefined)
  ])
}

function configuredTargetOptions(config: unknown): Record<string, unknown> | undefined {
  if (!isJsonObject(config) || !Array.isArray(config.plugin)) {
    return undefined
  }

  for (const entry of config.plugin) {
    const options = targetPluginOptions(entry)
    if (options !== undefined) {
      return options
    }
  }

  return undefined
}

async function inspectPolicyArtifact(
  optionName: PolicyArtifactOptionName,
  configuredPath: unknown,
  cwd: string,
  home: string | undefined
): Promise<PolicyArtifactHealth> {
  if (typeof configuredPath !== 'string' || configuredPath.length === 0) {
    return { optionName, status: 'not-configured' }
  }

  const path = resolveConfiguredPath(configuredPath, cwd, home)

  try {
    const source = await readFile(path, 'utf8')
    parseAdapterRuntimePolicyArtifact(JSON.parse(source) as unknown)
    return { optionName, path, status: 'ok' }
  } catch (caughtError) {
    if (isNodeError(caughtError) && caughtError.code === 'ENOENT') {
      return { optionName, path, status: 'missing' }
    }

    return {
      optionName,
      path,
      status: 'malformed',
      error: caughtError instanceof Error ? caughtError.message : String(caughtError)
    }
  }
}

function notConfiguredPolicyArtifacts(): PolicyArtifactHealth[] {
  return [
    { optionName: 'userPolicyArtifactFile', status: 'not-configured' },
    { optionName: 'policyArtifactFile', status: 'not-configured' }
  ]
}

function resolveConfiguredPath(path: string, cwd: string, home: string | undefined): string {
  if (home !== undefined && path === '~') {
    return home
  }

  if (home !== undefined && path.startsWith('~/')) {
    return resolve(home, path.slice(2))
  }

  return isAbsolute(path) ? path : resolve(cwd, path)
}

function formatPolicyArtifactHealth(artifact: PolicyArtifactHealth): string {
  const pathSuffix = artifact.path === undefined ? '' : ` (${artifact.path})`
  const errorSuffix = artifact.error === undefined ? '' : `: ${artifact.error}`
  return `Policy artifact ${artifact.optionName}: ${formatPolicyArtifactStatus(artifact.status)}${pathSuffix}${errorSuffix}`
}

function formatPolicyArtifactStatus(status: PolicyArtifactStatus): string {
  if (status === 'not-configured') {
    return 'not configured'
  }

  return status
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

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}
