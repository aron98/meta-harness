import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { renderUpgradeReport, upgradeOpenCodeMetaHarness } from '../src/upgrade'

async function makeTempProject() {
  return mkdtemp(join(tmpdir(), 'opencode-meta-harness-upgrade-'))
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>
}

describe('OpenCode meta-harness upgrade', () => {
  it('updates configured plugin to explicit newer package spec while preserving tuple options', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot, repoId: 'repo-alpha' }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      changed: true,
      previousPackageSpec: '@meta-harness/opencode-meta-harness',
      nextPackageSpec: '@meta-harness/opencode-meta-harness@0.2.0',
      dryRun: false
    })
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot, repoId: 'repo-alpha' }]]
    })
  })

  it('updates bare configured plugin to explicit latest even when the CLI is latest', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot, repoId: 'repo-alpha' }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      changed: true,
      previousPackageSpec: '@meta-harness/opencode-meta-harness',
      nextPackageSpec: '@meta-harness/opencode-meta-harness@0.2.0'
    })
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot, repoId: 'repo-alpha' }]]
    })
  })

  it('updates stale explicit configured plugin to latest even when the CLI is latest', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness@0.1.0', { dataRoot, repoId: 'repo-alpha' }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      changed: true,
      previousPackageSpec: '@meta-harness/opencode-meta-harness@0.1.0',
      nextPackageSpec: '@meta-harness/opencode-meta-harness@0.2.0'
    })
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot, repoId: 'repo-alpha' }]]
    })
  })

  it('is safe when already up to date', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result.changed).toBe(false)
    expect(result.nextPackageSpec).toBe('@meta-harness/opencode-meta-harness@0.2.0')
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot }]]
    })
  })

  it('reports unknown latest version instead of already up to date when update status is unknown', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => undefined
    })
    const report = renderUpgradeReport(result)

    expect(result.changed).toBe(false)
    expect(result.health.latestVersion).toBeUndefined()
    expect(report).not.toContain('already up to date')
    expect(report).toContain('Latest npm version: unknown')
    expect(report).toContain('Cannot determine whether an update is available')
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    })
  })

  it('does not write or synthesize config when plugin is not configured', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const existingConfig = {
      theme: 'system',
      plugin: ['other-plugin']
    }
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result.changed).toBe(false)
    expect(result.health.pluginConfigured).toBe(false)
    expect(result.previousPackageSpec).toBeUndefined()
    expect(result.nextPackageSpec).toBeUndefined()
    await expect(readJson(configPath)).resolves.toEqual(existingConfig)
  })

  it('does not overwrite invalid JSON', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, '{ invalid json', 'utf8')

    await expect(upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })).rejects.toThrow(`Could not parse OpenCode config at ${configPath}`)

    await expect(readFile(configPath, 'utf8')).resolves.toBe('{ invalid json')
  })

  it('supports dry-run without writing the newer package spec', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot: '/custom/data-root' }]]
    }, null, 2), 'utf8')

    const result = await upgradeOpenCodeMetaHarness({
      cwd,
      home,
      env: {},
      dryRun: true,
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      changed: true,
      dryRun: true,
      nextPackageSpec: '@meta-harness/opencode-meta-harness@0.2.0'
    })
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot: '/custom/data-root' }]]
    })
  })
})
