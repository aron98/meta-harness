import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import { renderHelp, run } from '../src/cli'

function makeOutput() {
  return {
    log: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>()
  }
}

describe('OpenCode meta-harness CLI', () => {
  it('renders install help for npx usage', () => {
    expect(renderHelp()).toContain('npx @meta-harness/opencode-meta-harness install')
    expect(renderHelp()).toContain('global OpenCode config')
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
})
