import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { inspectOpenCodeMetaHarnessHealth, renderHealthReport } from '../src/doctor'

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

  it('reports not configured policy artifact health when no policy paths are configured', async () => {
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

    expect(result.policyArtifacts).toEqual([
      { optionName: 'userPolicyArtifactFile', status: 'not-configured' },
      { optionName: 'policyArtifactFile', status: 'not-configured' }
    ])
    expect(renderHealthReport(result)).toContain('Policy artifact userPolicyArtifactFile: not configured')
    expect(renderHealthReport(result)).toContain('Policy artifact policyArtifactFile: not configured')
  })

  it('reports ok, missing, and malformed configured policy artifact health without throwing', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const userPolicyArtifactFile = join(home, 'user-policy.json')
    const malformedPolicyArtifactFile = join(cwd, 'project-policy.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(userPolicyArtifactFile, JSON.stringify({
      runId: 'run-1',
      candidateId: 'candidate-1',
      policy: { retrieval: { repoMatchWeight: 2 } }
    }), 'utf8')
    await writeFile(malformedPolicyArtifactFile, JSON.stringify({
      runId: 'run-2',
      candidateId: 'candidate-2',
      policy: {}
    }), 'utf8')
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', {
        dataRoot: '/custom/data-root',
        userPolicyArtifactFile,
        policyArtifactFile: malformedPolicyArtifactFile
      }]]
    }, null, 2), 'utf8')

    const malformedResult = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => undefined
    })

    expect(malformedResult.policyArtifacts).toEqual([
      { optionName: 'userPolicyArtifactFile', path: userPolicyArtifactFile, status: 'ok' },
      {
        optionName: 'policyArtifactFile',
        path: malformedPolicyArtifactFile,
        status: 'malformed',
        error: expect.stringContaining('Runtime policy artifact policy must include retrieval, routing, verification, or context')
      }
    ])
    expect(renderHealthReport(malformedResult)).toContain(`Policy artifact userPolicyArtifactFile: ok (${userPolicyArtifactFile})`)
    expect(renderHealthReport(malformedResult)).toContain(`Policy artifact policyArtifactFile: malformed (${malformedPolicyArtifactFile})`)

    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', {
        dataRoot: '/custom/data-root',
        userPolicyArtifactFile: join(home, 'missing-user-policy.json')
      }]]
    }, null, 2), 'utf8')

    const missingResult = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => undefined
    })

    expect(missingResult.policyArtifacts).toEqual([
      {
        optionName: 'userPolicyArtifactFile',
        path: join(home, 'missing-user-policy.json'),
        status: 'missing'
      },
      { optionName: 'policyArtifactFile', status: 'not-configured' }
    ])
    expect(renderHealthReport(missingResult)).toContain(`Policy artifact userPolicyArtifactFile: missing (${join(home, 'missing-user-policy.json')})`)
  })

  it('expands user policy artifact tilde paths with the injected home directory', async () => {
    const cwd = await makeTempProject()
    const home = join(cwd, 'home')
    const configPath = join(home, '.config', 'opencode', 'opencode.json')
    const userPolicyArtifactFile = join(home, 'policy.json')
    await mkdir(join(home, '.config', 'opencode'), { recursive: true })
    await writeFile(userPolicyArtifactFile, JSON.stringify({
      runId: 'run-home',
      candidateId: 'candidate-home',
      policy: { verification: { includeArtifactVerificationCommands: true } }
    }), 'utf8')
    await writeFile(configPath, JSON.stringify({
      plugin: [['@meta-harness/opencode-meta-harness', {
        dataRoot: '/custom/data-root',
        userPolicyArtifactFile: '~/policy.json'
      }]]
    }, null, 2), 'utf8')

    const result = await inspectOpenCodeMetaHarnessHealth({
      cwd,
      home,
      env: {},
      packageVersionProvider: async () => '0.2.0',
      latestVersionProvider: async () => undefined
    })

    expect(result.policyArtifacts).toEqual([
      { optionName: 'userPolicyArtifactFile', path: userPolicyArtifactFile, status: 'ok' },
      { optionName: 'policyArtifactFile', status: 'not-configured' }
    ])
  })
})
