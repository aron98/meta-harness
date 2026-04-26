import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { inspectOpenCodeMetaHarnessHealth, type HealthCheckOptions, type OpenCodeMetaHarnessHealth } from './doctor'
import {
  computeConfiguredUpdateStatus,
  isJsonObject,
  OPENCODE_META_HARNESS_PACKAGE_NAME,
  readConfig,
  resolveConfigPath,
  resolveDataRoot,
  targetPluginOptions,
  type JsonObject,
  type PluginEntry
} from './install'

export type UpgradeOpenCodeMetaHarnessOptions = HealthCheckOptions & {
  dryRun?: boolean
}

export type UpgradeOpenCodeMetaHarnessResult = {
  configPath: string
  dataRoot: string
  dryRun: boolean
  changed: boolean
  previousPackageSpec?: string
  nextPackageSpec?: string
  health: OpenCodeMetaHarnessHealth
}

export async function upgradeOpenCodeMetaHarness(
  options: UpgradeOpenCodeMetaHarnessOptions = {}
): Promise<UpgradeOpenCodeMetaHarnessResult> {
  const health = await inspectOpenCodeMetaHarnessHealth(options)
  const cwd = resolve(options.cwd ?? process.cwd())
  const home = resolve(options.home ?? process.env.HOME ?? cwd)
  const env = options.env ?? process.env
  const dryRun = options.dryRun === true
  const configPath = resolveConfigPath({ home, env })
  const dataRoot = resolveDataRoot({ home, env })

  if (!health.configParses) {
    await readConfig(configPath)
  }

  if (!health.pluginConfigured || computeConfiguredUpdateStatus(health.configuredPackageSpec, health.latestVersion) !== 'update-available' || health.latestVersion === undefined) {
    return {
      configPath,
      dataRoot,
      dryRun,
      changed: false,
      previousPackageSpec: health.configuredPackageSpec,
      nextPackageSpec: health.configuredPackageSpec,
      health
    }
  }

  const existingConfig = await readConfig(configPath)
  const previousPackageSpec = health.configuredPackageSpec
  const nextPackageSpec = `${OPENCODE_META_HARNESS_PACKAGE_NAME}@${health.latestVersion}`
  const nextConfig = patchUpgradeConfig(existingConfig.config, nextPackageSpec)
  const changed = JSON.stringify(existingConfig.config) !== JSON.stringify(nextConfig)

  if (!dryRun && changed) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
  }

  return {
    configPath,
    dataRoot,
    dryRun,
    changed,
    previousPackageSpec,
    nextPackageSpec,
    health
  }
}

export function renderUpgradeReport(result: UpgradeOpenCodeMetaHarnessResult): string {
  if (!result.health.configParses) {
    return `Could not upgrade @meta-harness/opencode-meta-harness: OpenCode config does not parse at ${result.configPath}`
  }

  if (!result.health.pluginConfigured) {
    return `No @meta-harness/opencode-meta-harness plugin entry found in ${result.configPath}. Run install first.`
  }

  if (!result.changed && result.health.latestVersion === undefined) {
    return [
      'Cannot determine whether an update is available for @meta-harness/opencode-meta-harness',
      `OpenCode config: ${result.configPath}`,
      `Configured package spec: ${result.nextPackageSpec ?? 'unknown'}`,
      'Latest npm version: unknown',
      'Config changed: no'
    ].join('\n')
  }

  if (!result.changed) {
    return [
      '@meta-harness/opencode-meta-harness is already up to date',
      `OpenCode config: ${result.configPath}`,
      `Configured package spec: ${result.nextPackageSpec ?? 'unknown'}`
    ].join('\n')
  }

  const verb = result.dryRun ? 'Would update' : 'Updated'
  return [
    `${verb} @meta-harness/opencode-meta-harness to ${result.health.latestVersion ?? 'unknown'}`,
    `OpenCode config: ${result.configPath}`,
    `Previous package spec: ${result.previousPackageSpec ?? 'unknown'}`,
    `Next package spec: ${result.nextPackageSpec ?? 'unknown'}`,
    `Config changed: ${result.dryRun ? 'no (dry run)' : 'yes'}`
  ].join('\n')
}

function patchUpgradeConfig(config: JsonObject | undefined, nextPackageSpec: string): JsonObject {
  if (!config) {
    return { plugin: [[nextPackageSpec, { dataRoot: '' }]] }
  }

  const nextConfig: JsonObject = { ...config }
  const pluginEntries = Array.isArray(nextConfig.plugin) ? nextConfig.plugin : []
  nextConfig.plugin = patchUpgradePluginEntries(pluginEntries, nextPackageSpec)
  return nextConfig
}

function patchUpgradePluginEntries(pluginEntries: PluginEntry[], nextPackageSpec: string): PluginEntry[] {
  const nextEntries: PluginEntry[] = []
  let upgraded = false

  for (const entry of pluginEntries) {
    const targetOptions = targetPluginOptions(entry)
    if (targetOptions) {
      if (!upgraded) {
        nextEntries.push([nextPackageSpec, preserveOptions(entry, targetOptions)])
        upgraded = true
      }
      continue
    }

    nextEntries.push(entry)
  }

  return nextEntries
}

function preserveOptions(entry: PluginEntry, targetOptions: JsonObject): JsonObject {
  if (Array.isArray(entry) && isJsonObject(entry[1])) {
    return { ...entry[1] }
  }

  return { ...targetOptions }
}
