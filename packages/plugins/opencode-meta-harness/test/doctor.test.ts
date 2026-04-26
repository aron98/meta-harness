import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { inspectOpenCodeMetaHarnessHealth } from '../src/doctor'

async function makeTempProject() {
  return mkdtemp(join(tmpdir(), 'opencode-meta-harness-doctor-'))
}

describe('OpenCode meta-harness doctor', () => {
  it('reports config paths, configured plugin, package versions, and update availability', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await mkdir(dataRoot, { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness@0.1.0', { dataRoot, repoId: 'repo-alpha' }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      configPath,
      dataRoot,
      configExists: true,
      configParses: true,
      pluginConfigured: true,
      configuredPackageSpec: '@meta-harness/opencode-meta-harness@0.1.0',
      dataRootExists: true,
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      updateStatus: 'update-available'
    })
  })

  it('reports update availability from a bare configured package spec even when the CLI is latest', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot: '/custom/data-root' }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      configuredPackageSpec: '@meta-harness/opencode-meta-harness',
      currentVersion: '0.2.0',
      latestVersion: '0.2.0',
      updateStatus: 'update-available'
    })
  })

  it('reports update availability from a stale explicit configured package spec even when the CLI is latest', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness@0.1.0', { dataRoot: '/custom/data-root' }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toMatchObject({
      configuredPackageSpec: '@meta-harness/opencode-meta-harness@0.1.0',
      currentVersion: '0.2.0',
      latestVersion: '0.2.0',
      updateStatus: 'update-available'
    })
  })

  it('reports up to date for an explicit configured package spec equal to latest', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness@0.2.0', { dataRoot: '/custom/data-root' }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result.updateStatus).toBe('up-to-date')
  })

  it('reports unknown update status for a configured package spec when latest is unknown', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot: '/custom/data-root' }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => undefined
    })

    expect(result.updateStatus).toBe('unknown')
  })

  it('keeps invalid JSON safe and reports unknown latest version when provider fails', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, '{ invalid json', 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => undefined
    })

    expect(result).toMatchObject({
      configPath,
      configExists: true,
      configParses: false,
      pluginConfigured: false,
      configuredPackageSpec: undefined,
      currentVersion: '0.1.0',
      latestVersion: undefined,
      updateStatus: 'unknown'
    })
    expect(result.configParseError).toContain(`Could not parse OpenCode config at ${configPath}`)
  })
})
