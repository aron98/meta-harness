import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { isCliEntrypoint, renderHelp, run } from '../src/cli'

function makeOutput() {
  return {
    log: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>()
  }
}

describe('OpenCode meta-harness CLI', () => {
  it('renders install help for npx usage', () => {
    expect(renderHelp()).toContain('npx @meta-harness/opencode-meta-harness install')
    expect(renderHelp()).toContain('npx @meta-harness/opencode-meta-harness doctor')
    expect(renderHelp()).toContain('npx @meta-harness/opencode-meta-harness upgrade')
    expect(renderHelp()).toContain('global OpenCode config')
    expect(renderHelp()).not.toContain('--global')
  })

  it('detects npm bin symlinks as CLI entrypoints', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'opencode-meta-harness-cli-'))
    const realEntrypoint = join(cwd, 'dist', 'cli.js')
    const binEntrypoint = join(cwd, '.bin', 'opencode-meta-harness')
    await mkdir(join(cwd, 'dist'), { recursive: true })
    await mkdir(join(cwd, '.bin'), { recursive: true })
    await writeFile(realEntrypoint, '', 'utf8')
    await symlink(realEntrypoint, binEntrypoint)

    expect(isCliEntrypoint(pathToFileURL(realEntrypoint).href, binEntrypoint)).toBe(true)
  })

  it('rejects removed global install flags', async () => {
    const output = makeOutput()

    const result = await run(['install', '--global'], { log: output.log }, { error: output.error })

    expect(result).toEqual({
      success: false,
      exitCode: 1,
      output: 'Unknown install option: --global',
      error: 'Unknown install option: --global'
    })
    expect(output.log).not.toHaveBeenCalled()
    expect(output.error).toHaveBeenCalledWith('Unknown install option: --global')
  })

  it('dispatches install to the package installer', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'opencode-meta-harness-cli-'))
    const home = join(cwd, 'home')
    const output = makeOutput()

    const result = await run(['install'], { log: output.log }, {
      error: output.error,
      cwd,
      home,
      env: {}
    })

    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await expect(readFile(join(home, '.config', 'opencode', 'opencode.json'), 'utf8')).resolves.toContain(dataRoot)
    expect(result).toEqual({ success: true, exitCode: 0, output: expect.stringContaining('Installed @meta-harness/opencode-meta-harness') })
    expect(output.error).not.toHaveBeenCalled()
  })

  it('dispatches doctor with injected package metadata providers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'opencode-meta-harness-cli-'))
    const home = join(cwd, 'home')
    const output = makeOutput()

    const result = await run(['doctor'], { log: output.log }, {
      error: output.error,
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toEqual({ success: true, exitCode: 0, output: expect.stringContaining('Update status: unknown') })
    expect(result.output).toContain('Current package version: 0.1.0')
    expect(result.output).toContain('Latest npm version: 0.2.0')
    expect(output.log).toHaveBeenCalledWith(result.output)
    expect(output.error).not.toHaveBeenCalled()
  })

  it('dispatches upgrade and reports an explicit updated package spec', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'opencode-meta-harness-cli-'))
    const home = join(cwd, 'home')
    await run(['install'], { log: vi.fn<(message: string) => void>() }, { cwd, home, env: {} })
    const output = makeOutput()

    const result = await run(['upgrade'], { log: output.log }, {
      error: output.error,
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.1.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toEqual({ success: true, exitCode: 0, output: expect.stringContaining('Updated @meta-harness/opencode-meta-harness to 0.2.0') })
    expect(output.log).toHaveBeenCalledWith(result.output)
    expect(output.error).not.toHaveBeenCalled()
  })

  it('install output recommends upgrade for an already configured bare plugin when latest is known and CLI is latest', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'opencode-meta-harness-cli-'))
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const dataRoot = join(home, '.local', 'share', 'opencode-meta-harness')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', { dataRoot }]]
    }, null, 2), 'utf8')
    const output = makeOutput()

    const result = await run(['install'], { log: output.log }, {
      error: output.error,
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => '0.2.0'
    })

    expect(result).toEqual({ success: true, exitCode: 0, output: expect.stringContaining('Run: npx @meta-harness/opencode-meta-harness upgrade') })
    expect(result.output).toContain('Update available: 0.2.0')
    expect(output.error).not.toHaveBeenCalled()
  })
})
