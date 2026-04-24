import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { installOpenCodeMetaHarness } from '../src/install'

async function makeTempProject() {
  return mkdtemp(join(tmpdir(), 'opencode-meta-harness-install-'))
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>
}

describe('OpenCode meta-harness installer', () => {
  it('creates project-local OpenCode config and data directory by default', async () => {
    const cwd = await makeTempProject()

    const result = await installOpenCodeMetaHarness({ cwd, home: join(cwd, 'home') })

    const configPath = join(cwd, '.opencode', 'opencode.json')
    const dataRoot = join(cwd, '.local', 'share', 'opencode-meta-harness')
    expect((await stat(dataRoot)).isDirectory()).toBe(true)
    await expect(readJson(configPath)).resolves.toEqual({
      $schema: 'https://opencode.ai/config.json',
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    })
    expect(await readFile(configPath, 'utf8')).toBe(`${JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    }, null, 2)}\n`)
    expect(result).toEqual({
      configPath,
      dataRoot,
      dryRun: false,
      changed: true
    })
  })

  it('preserves existing config keys and replaces string plugin entries with the dataRoot tuple', async () => {
    const cwd = await makeTempProject()
    const configPath = join(cwd, '.opencode', 'opencode.json')
    await mkdir(join(cwd, '.opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      $schema: 'https://example.com/custom-opencode-schema.json',
      theme: 'system',
      plugin: ['other-plugin', '@meta-harness/opencode-meta-harness']
    }, null, 2), 'utf8')

    await installOpenCodeMetaHarness({ cwd, home: join(cwd, 'home') })

    const dataRoot = join(cwd, '.local', 'share', 'opencode-meta-harness')
    await expect(readJson(configPath)).resolves.toEqual({
      $schema: 'https://example.com/custom-opencode-schema.json',
      theme: 'system',
      plugin: [
        'other-plugin',
        ['@meta-harness/opencode-meta-harness', { dataRoot }]
      ]
    })
  })

  it('updates an existing tuple entry without adding duplicates', async () => {
    const cwd = await makeTempProject()
    const configPath = join(cwd, '.opencode', 'opencode.json')
    await mkdir(join(cwd, '.opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [
        ['@meta-harness/opencode-meta-harness', { dataRoot: '/old/path', repoId: 'repo-alpha' }],
        '@meta-harness/opencode-meta-harness'
      ]
    }, null, 2), 'utf8')

    await installOpenCodeMetaHarness({ cwd, home: join(cwd, 'home') })

    const dataRoot = join(cwd, '.local', 'share', 'opencode-meta-harness')
    await expect(readJson(configPath)).resolves.toEqual({
      plugin: [
        ['@meta-harness/opencode-meta-harness', { dataRoot, repoId: 'repo-alpha' }]
      ]
    })
  })

  it('uses XDG OpenCode config and data paths for global installs', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const xdgConfigHome = join(cwd, 'xdg-config')
    const xdgDataHome = join(cwd, 'xdg-data')

    const result = await installOpenCodeMetaHarness({
      cwd,
      home,
      global: true,
      env: { XDG_CONFIG_HOME: xdgConfigHome, XDG_DATA_HOME: xdgDataHome }
    })

    const configPath = join(xdgConfigHome, 'opencode', 'opencode.json')
    const dataRoot = join(xdgDataHome, 'opencode-meta-harness')
    await expect(readJson(configPath)).resolves.toEqual({
      $schema: 'https://opencode.ai/config.json',
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    })
    expect((await stat(dataRoot)).isDirectory()).toBe(true)
    expect(result.configPath).toBe(configPath)
    expect(result.dataRoot).toBe(dataRoot)
  })

  it('resolves injected relative cwd and home paths to absolute local install paths', async () => {
    const absoluteCwd = await makeTempProject()
    const relativeCwd = relative(process.cwd(), absoluteCwd)
    const relativeHome = relative(process.cwd(), join(absoluteCwd, 'home'))

    const result = await installOpenCodeMetaHarness({ cwd: relativeCwd, home: relativeHome })

    const configPath = resolve(relativeCwd, '.opencode', 'opencode.json')
    const dataRoot = resolve(relativeCwd, '.local', 'share', 'opencode-meta-harness')
    expect(isAbsolute(result.configPath)).toBe(true)
    expect(isAbsolute(result.dataRoot)).toBe(true)
    expect(result).toMatchObject({ configPath, dataRoot })
    await expect(readJson(configPath)).resolves.toEqual({
      $schema: 'https://opencode.ai/config.json',
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    })
  })

  it('resolves injected relative XDG paths to absolute global install paths', async () => {
    const absoluteCwd = await makeTempProject()
    const relativeHome = relative(process.cwd(), join(absoluteCwd, 'home'))
    const xdgConfigHome = relative(process.cwd(), join(absoluteCwd, 'xdg-config'))
    const xdgDataHome = relative(process.cwd(), join(absoluteCwd, 'xdg-data'))

    const result = await installOpenCodeMetaHarness({
      cwd: relative(process.cwd(), absoluteCwd),
      home: relativeHome,
      global: true,
      env: { XDG_CONFIG_HOME: xdgConfigHome, XDG_DATA_HOME: xdgDataHome }
    })

    const configPath = resolve(xdgConfigHome, 'opencode', 'opencode.json')
    const dataRoot = resolve(xdgDataHome, 'opencode-meta-harness')
    expect(isAbsolute(result.configPath)).toBe(true)
    expect(isAbsolute(result.dataRoot)).toBe(true)
    expect(result).toMatchObject({ configPath, dataRoot })
    await expect(readJson(configPath)).resolves.toEqual({
      $schema: 'https://opencode.ai/config.json',
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    })
  })

  it('creates dataRoot before attempting a config write that fails', async () => {
    const cwd = await makeTempProject()
    const configDir = join(cwd, '.opencode')
    const dataRoot = join(cwd, '.local', 'share', 'opencode-meta-harness')
    await mkdir(configDir, { recursive: true })
    await chmod(configDir, 0o500)

    try {
      await expect(installOpenCodeMetaHarness({ cwd, home: join(cwd, 'home') })).rejects.toThrow()
      expect((await stat(dataRoot)).isDirectory()).toBe(true)
    } finally {
      await chmod(configDir, 0o700)
    }
  })

  it('rejects invalid JSON without overwriting the existing config', async () => {
    const cwd = await makeTempProject()
    const configPath = join(cwd, '.opencode', 'opencode.json')
    await mkdir(join(cwd, '.opencode'), { recursive: true })
    await writeFile(configPath, '{ invalid json', 'utf8')

    await expect(installOpenCodeMetaHarness({ cwd, home: join(cwd, 'home') })).rejects.toThrow(
      `Could not parse OpenCode config at ${configPath}`
    )
    await expect(readFile(configPath, 'utf8')).resolves.toBe('{ invalid json')
  })
})
