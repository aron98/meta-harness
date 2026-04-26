import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const OPENCODE_META_HARNESS_PACKAGE_NAME = '@meta-harness/opencode-meta-harness'
export const OPENCODE_SCHEMA_URL = 'https://opencode.ai/config.json'

export type JsonObject = Record<string, unknown>
export type PluginTuple = [string, JsonObject]
export type PluginEntry = string | PluginTuple | unknown
export type VersionProvider = () => Promise<string | undefined>
export type ConfiguredUpdateStatus = 'up-to-date' | 'update-available' | 'unknown'

export type InstallOpenCodeMetaHarnessOptions = {
  cwd?: string
  home?: string
  dryRun?: boolean
  env?: Record<string, string | undefined>
  packageVersionProvider?: VersionProvider
  latestVersionProvider?: VersionProvider
}

export type InstallOpenCodeMetaHarnessResult = {
  configPath: string
  dataRoot: string
  dryRun: boolean
  changed: boolean
  alreadyInstalled: boolean
  configured: boolean
  currentVersion?: string
  latestVersion?: string
  updateAvailable: boolean
}

export async function installOpenCodeMetaHarness(
  options: InstallOpenCodeMetaHarnessOptions = {}
): Promise<InstallOpenCodeMetaHarnessResult> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const home = resolve(options.home ?? process.env.HOME ?? cwd)
  const env = options.env ?? process.env
  const dryRun = options.dryRun === true
  const configPath = resolveConfigPath({ home, env })
  const dataRoot = resolveDataRoot({ home, env })
  const existingConfig = await readConfig(configPath)
  const alreadyInstalled = hasTargetPlugin(existingConfig.config)
  const nextConfig = patchConfig(existingConfig.config, dataRoot)
  const nextJson = `${JSON.stringify(nextConfig, null, 2)}\n`
  const changed = hasSemanticConfigChange(existingConfig.config, nextConfig)
  const currentVersion = alreadyInstalled ? await resolvePackageVersion(options.packageVersionProvider) : undefined
  const latestVersion = alreadyInstalled ? await resolveLatestVersion(options.latestVersionProvider) : undefined
  const configuredPackageSpec = findConfiguredPackageSpec(nextConfig)
  const updateAvailable = alreadyInstalled && computeConfiguredUpdateStatus(configuredPackageSpec, latestVersion) === 'update-available'

  if (!dryRun) {
    await mkdir(dataRoot, { recursive: true })
  }

  if (!dryRun && changed) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, nextJson, 'utf8')
  }

  return {
    configPath,
    dataRoot,
    dryRun,
    changed,
    alreadyInstalled,
    configured: true,
    currentVersion,
    latestVersion,
    updateAvailable
  }
}

export function resolveConfigPath(input: {
  home: string
  env: Record<string, string | undefined>
}): string {
  const configHome = input.env.XDG_CONFIG_HOME ? resolve(input.env.XDG_CONFIG_HOME) : resolve(input.home, '.config')
  return resolve(configHome, 'opencode', 'opencode.json')
}

export function resolveDataRoot(input: {
  home: string
  env: Record<string, string | undefined>
}): string {
  const dataHome = input.env.XDG_DATA_HOME ? resolve(input.env.XDG_DATA_HOME) : resolve(input.home, '.local', 'share')
  return resolve(dataHome, 'opencode-meta-harness')
}

export async function readConfig(configPath: string): Promise<{ config: JsonObject | undefined; source: string | undefined }> {
  let source: string

  try {
    source = await readFile(configPath, 'utf8')
  } catch (caughtError) {
    if (isNodeError(caughtError) && caughtError.code === 'ENOENT') {
      return { config: undefined, source: undefined }
    }

    throw caughtError
  }

  try {
    const parsed = JSON.parse(source) as unknown
    if (isJsonObject(parsed)) {
      return { config: parsed, source }
    }

    throw new Error('OpenCode config root must be a JSON object')
  } catch (caughtError) {
    const reason = caughtError instanceof Error ? caughtError.message : String(caughtError)
    throw new Error(`Could not parse OpenCode config at ${configPath}: ${reason}`)
  }
}

export function patchConfig(config: JsonObject | undefined, dataRoot: string): JsonObject {
  const nextConfig: JsonObject = config ? { ...config } : { $schema: OPENCODE_SCHEMA_URL }
  const pluginEntries = Array.isArray(nextConfig.plugin) ? nextConfig.plugin : []
  nextConfig.plugin = patchPluginEntries(pluginEntries, dataRoot)
  return nextConfig
}

function patchPluginEntries(pluginEntries: PluginEntry[], dataRoot: string): PluginEntry[] {
  const nextEntries: PluginEntry[] = []
  let addedTarget = false

  for (const entry of pluginEntries) {
    const targetOptions = targetPluginOptions(entry)

    if (targetOptions) {
      if (!addedTarget) {
        nextEntries.push([targetPackageSpec(entry), { ...targetOptions, dataRoot }])
        addedTarget = true
      }

      continue
    }

    nextEntries.push(entry)
  }

  if (!addedTarget) {
    nextEntries.push([OPENCODE_META_HARNESS_PACKAGE_NAME, { dataRoot }])
  }

  return nextEntries
}

export function targetPluginOptions(entry: PluginEntry): JsonObject | undefined {
  if (isTargetPackageSpec(entry)) {
    return {}
  }

  if (!Array.isArray(entry) || !isTargetPackageSpec(entry[0])) {
    return undefined
  }

  const options = entry[1]
  return isJsonObject(options) ? options : {}
}

export function targetPackageSpec(entry: PluginEntry): string {
  if (typeof entry === 'string' && isTargetPackageSpec(entry)) {
    return entry
  }

  if (Array.isArray(entry) && typeof entry[0] === 'string' && isTargetPackageSpec(entry[0])) {
    return entry[0]
  }

  return OPENCODE_META_HARNESS_PACKAGE_NAME
}

export function isTargetPackageSpec(value: unknown): value is string {
  return typeof value === 'string' && (
    value === OPENCODE_META_HARNESS_PACKAGE_NAME ||
    value.startsWith(`${OPENCODE_META_HARNESS_PACKAGE_NAME}@`)
  )
}

export function hasTargetPlugin(config: JsonObject | undefined): boolean {
  if (!config || !Array.isArray(config.plugin)) {
    return false
  }

  return config.plugin.some((entry) => targetPluginOptions(entry) !== undefined)
}

export function findConfiguredPackageSpec(config: JsonObject | undefined): string | undefined {
  if (!config || !Array.isArray(config.plugin)) {
    return undefined
  }

  const entry = config.plugin.find((pluginEntry) => targetPluginOptions(pluginEntry) !== undefined)
  return entry === undefined ? undefined : targetPackageSpec(entry)
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10))
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10))
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1
    }
  }

  return 0
}

export function configuredPackageVersion(packageSpec: string | undefined): string | undefined {
  const versionPrefix = `${OPENCODE_META_HARNESS_PACKAGE_NAME}@`
  if (!packageSpec || !packageSpec.startsWith(versionPrefix)) {
    return undefined
  }

  const version = packageSpec.slice(versionPrefix.length)
  return version.length > 0 ? version : undefined
}

export function computeConfiguredUpdateStatus(
  packageSpec: string | undefined,
  latestVersion: string | undefined
): ConfiguredUpdateStatus {
  if (!packageSpec || !latestVersion) {
    return 'unknown'
  }

  const configuredVersion = configuredPackageVersion(packageSpec)
  if (configuredVersion === undefined) {
    return 'update-available'
  }

  return compareVersions(latestVersion, configuredVersion) > 0 ? 'update-available' : 'up-to-date'
}

export async function resolvePackageVersion(provider: VersionProvider | undefined): Promise<string | undefined> {
  if (provider) {
    return resolveOptionalVersion(provider)
  }

  try {
    const source = await readFile(new URL('../package.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(source) as unknown
    return isJsonObject(parsed) && typeof parsed.version === 'string' ? parsed.version : undefined
  } catch {
    return undefined
  }
}

export async function resolveLatestVersion(provider: VersionProvider | undefined): Promise<string | undefined> {
  if (provider) {
    return resolveOptionalVersion(provider)
  }

  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(OPENCODE_META_HARNESS_PACKAGE_NAME)}/latest`)
    if (!response.ok) {
      return undefined
    }

    const parsed = await response.json() as unknown
    return isJsonObject(parsed) && typeof parsed.version === 'string' ? parsed.version : undefined
  } catch {
    return undefined
  }
}

export async function resolveOptionalVersion(provider: VersionProvider | undefined): Promise<string | undefined> {
  if (!provider) {
    return undefined
  }

  try {
    return await provider()
  } catch {
    return undefined
  }
}

function hasSemanticConfigChange(current: JsonObject | undefined, next: JsonObject): boolean {
  return JSON.stringify(current) !== JSON.stringify(next)
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}
