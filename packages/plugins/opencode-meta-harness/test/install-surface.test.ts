import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import plugin from '../src/index'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testDir, '..')
const localPluginReExport = "export { default } from '/absolute/path/to/meta-harness/packages/plugins/opencode-meta-harness/dist/index.js'"
const npmConfigSnippet = `{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@meta-harness/opencode-meta-harness"]
}`

describe('OpenCode plugin install surface', () => {
  it('exposes the package entrypoints that install docs depend on', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(packageDir, 'package.json'), 'utf8')
    ) as {
      name: string
      files?: string[]
      exports?: {
        '.': {
          import?: string
          require?: string
          types?: string
        }
      }
    }

    expect(packageJson.name).toBe('@meta-harness/opencode-meta-harness')
    expect(packageJson.files).toContain('dist')
    expect(packageJson.exports?.['.']).toMatchObject({
      import: './dist/index.js',
      require: './dist/index.cjs',
      types: './dist/index.d.ts'
    })
    expect(plugin.id).toBe('opencode-meta-harness')
  })

  it('documents only the verified install hooks and setup paths', async () => {
    const readme = await readFile(resolve(packageDir, 'README.md'), 'utf8')

    expect(readme).toContain('## Install from a repo checkout')
    expect(readme).toContain('Project-local plugin file in `.opencode/plugins/meta-harness.js`:')
    expect(readme).toContain('Global plugin file in `~/.config/opencode/plugins/meta-harness.js`:')
    expect(readme).toContain(localPluginReExport)
    expect(readme).toContain('## Planned npm install flow')
    expect(readme).toContain(npmConfigSnippet)
    expect(readme).toContain('not published to npm yet')
    expect(readme).toContain('## Troubleshooting')
    expect(readme).toContain('`event` hook')
    expect(readme).toContain('`experimental.session.compacting` hook')
    expect(readme).toContain(
      'Treat `chat.message` as current implementation detail, not as a formally documented public OpenCode hook contract.'
    )
    expect(readme).toContain(
      'The package also currently derives task-start behavior from `chat.message`, but the public docs here intentionally avoid presenting that hook as a stable documented OpenCode contract.'
    )
  })
})
