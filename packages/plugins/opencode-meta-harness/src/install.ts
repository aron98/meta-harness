import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const OPENCODE_META_HARNESS_PACKAGE_NAME = '@meta-harness/opencode-meta-harness'
const OPENCODE_SCHEMA_URL = 'https://opencode.ai/config.json'

type JsonObject = Record<string, unknown>
type PluginTuple = [string, JsonObject]
type PluginEntry = string | PluginTuple | unknown

export type InstallOpenCodeMetaHarnessOptions = {
  cwd?: string
  home?: string
  /** @deprecated Installs are global by default; this flag is kept as a no-op compatibility alias. */
  global?: boolean
  dryRun?: boolean
  env?: Record<string, string | undefined>
}

export type InstallOpenCodeMetaHarnessResult = {
  configPath: string
  dataRoot: string
  dryRun: boolean
  changed: boolean
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
  const nextConfig = patchConfig(existingConfig.config, dataRoot)
  const nextJson = `${JSON.stringify(nextConfig, null, 2)}\n`
  const changed = existingConfig.source !== nextJson

  if (!dryRun) {
    await mkdir(dataRoot, { recursive: true })
  }

  if (!dryRun && changed) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, nextJson, 'utf8')
  }

  return { configPath, dataRoot, dryRun, changed }
}

function resolveConfigPath(input: {
  home: string
  env: Record<string, string | undefined>
}): string {
  const configHome = input.env.XDG_CONFIG_HOME ? resolve(input.env.XDG_CONFIG_HOME) : resolve(input.home, '.config')
  return resolve(configHome, 'opencode', 'opencode.json')
}

function resolveDataRoot(input: {
  home: string
  env: Record<string, string | undefined>
}): string {
  const dataHome = input.env.XDG_DATA_HOME ? resolve(input.env.XDG_DATA_HOME) : resolve(input.home, '.local', 'share')
  return resolve(dataHome, 'opencode-meta-harness')
}

async function readConfig(configPath: string): Promise<{ config: JsonObject | undefined; source: string | undefined }> {
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

function patchConfig(config: JsonObject | undefined, dataRoot: string): JsonObject {
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
        nextEntries.push([OPENCODE_META_HARNESS_PACKAGE_NAME, { ...targetOptions, dataRoot }])
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

function targetPluginOptions(entry: PluginEntry): JsonObject | undefined {
  if (entry === OPENCODE_META_HARNESS_PACKAGE_NAME) {
    return {}
  }

  if (!Array.isArray(entry) || entry[0] !== OPENCODE_META_HARNESS_PACKAGE_NAME) {
    return undefined
  }

  const options = entry[1]
  return isJsonObject(options) ? options : {}
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}
