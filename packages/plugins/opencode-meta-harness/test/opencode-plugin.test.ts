import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AdapterPolicyInput } from '@meta-harness/plugin-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpenCodePlugin } from '../src/index'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })))
})

function createStartTaskResult(input: {
  taskId: string
  taskType?: 'analysis' | 'implementation' | 'verification'
  suggestedRoute?: 'explore' | 'implement' | 'verify'
  selectedMemoryIds?: string[]
  selectedArtifactIds?: string[]
  startedAt?: string
}) {
  return {
    filePath: `/tmp/store/data/runtime/task-start/repo-alpha/${input.taskId}.json`,
    observabilityFilePath: `/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/${input.taskId}/task-start.json`,
    result: {
      taskStart: {
        startedAt: input.startedAt ?? '2026-04-22T15:20:00.000Z',
        verificationState: { status: 'pending' as const, checklist: ['Capture evidence'], completedSteps: [] },
        unresolvedQuestions: []
      },
      context: {
        taskId: input.taskId,
        packet: {
          taskType: input.taskType ?? 'analysis',
          suggestedRoute: input.suggestedRoute ?? 'explore',
          selectedMemoryIds: input.selectedMemoryIds ?? [],
          selectedArtifactIds: input.selectedArtifactIds ?? []
        }
      }
    }
  }
}

function runtimePolicyArtifact(input: {
  runId: string
  candidateId: string
  policyInput: AdapterPolicyInput
  maxMemories?: number
  maxArtifacts?: number
}) {
  return {
    runId: input.runId,
    candidateId: input.candidateId,
    policy: {
      ...input.policyInput,
      context: {
        maxMemories: input.maxMemories,
        maxArtifacts: input.maxArtifacts
      }
    }
  }
}

describe('OpenCode plugin host integration', () => {
  it('exposes a plugin module with stable id and chat.message hook', async () => {
    const createAdapter = vi.fn().mockReturnValue({
      startTask: vi.fn().mockResolvedValue(undefined)
    })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:00:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    expect(plugin.id).toBe('opencode-meta-harness')
    expect(hooks['chat.message']).toBeTypeOf('function')
  })

  it('derives a task-start call from chat.message in shadow mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const previousXdgDataHome = process.env.XDG_DATA_HOME
    const xdgDataHome = join(directory, 'xdg-data')
    const startTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    try {
      process.env.XDG_DATA_HOME = xdgDataHome
      const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:00:00.000Z' })
      const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

      await hooks['chat.message']?.(
        { sessionID: 'session-001', messageID: 'message-001' },
        { message: 'Please inspect the new OpenCode plugin integration boundary.' }
      )

      const defaultUserDataRoot = join(xdgDataHome, 'opencode-meta-harness')
      expect(createAdapter).toHaveBeenCalledWith({
        dataRoot: defaultUserDataRoot,
        runtimeRoots: { userDataRoot: defaultUserDataRoot }
      })
      expect(startTask).toHaveBeenCalledWith({
        packetId: 'message-001',
        repoId: 'repo-alpha',
        taskId: 'message-001',
        taskText: 'Please inspect the new OpenCode plugin integration boundary.',
        taskType: 'analysis',
        prompt: 'Please inspect the new OpenCode plugin integration boundary.',
        memoryRecords: [],
        artifactRecords: [],
        referenceTime: '2026-04-22T15:00:00.000Z'
      })
    } finally {
      if (previousXdgDataHome === undefined) {
        delete process.env.XDG_DATA_HOME
      } else {
        process.env.XDG_DATA_HOME = previousXdgDataHome
      }
    }
  })

  it('resolves user and project runtime roots from server options while keeping the user root available', async () => {
    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-100' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:00:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' },
      {
        userDataRoot: '~/opencode-meta-harness-user',
        dataRoot: '.opencode/meta-harness'
      }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-100', messageID: 'message-100' },
      { message: 'Inspect scoped runtime roots.' }
    )

    expect(createAdapter).toHaveBeenCalledWith({
      dataRoot: join(homedir(), 'opencode-meta-harness-user'),
      runtimeRoots: {
        userDataRoot: join(homedir(), 'opencode-meta-harness-user'),
        projectDataRoot: '/tmp/repo-alpha/.opencode/meta-harness'
      }
    })
    expect(startTask).toHaveBeenCalledWith(expect.objectContaining({
      runtimeRoots: {
        userDataRoot: join(homedir(), 'opencode-meta-harness-user'),
        projectDataRoot: '/tmp/repo-alpha/.opencode/meta-harness'
      },
      userMemoryRecords: [],
      projectMemoryRecords: [],
      userArtifactRecords: [],
      projectArtifactRecords: []
    }))
  })

  it('loads a configured user policy artifact once at server startup and forwards policy context', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const artifactFile = join(directory, 'user-policy.json')
    await writeFile(artifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'user-run',
      candidateId: 'user-candidate',
      policyInput: { routing: { buildPromptMode: 'prefer-analysis' } },
      maxMemories: 1,
      maxArtifacts: 0
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-101' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:05:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'user-policy.json' }
    )
    await writeFile(artifactFile, '{"not":"used after startup"}', 'utf8')

    await hooks['chat.message']?.(
      { sessionID: 'session-101', messageID: 'message-101' },
      { message: 'Inspect loaded user policy.' }
    )

    expect(startTask).toHaveBeenCalledWith(expect.objectContaining({
      policyInput: { routing: { buildPromptMode: 'prefer-analysis' } },
      maxMemories: 1,
      maxArtifacts: 0,
      policyIdentity: {
        runId: 'user-run',
        candidateId: 'user-candidate',
        sourceScope: 'user',
        artifactFile
      }
    }))
  })

  it('lets a configured project policy artifact override a configured user policy artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const userArtifactFile = join(directory, 'user-policy.json')
    const projectArtifactFile = join(directory, 'project-policy.json')
    await writeFile(userArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'user-run',
      candidateId: 'user-candidate',
      policyInput: { routing: { buildPromptMode: 'prefer-analysis' } },
      maxMemories: 3,
      maxArtifacts: 2
    })), 'utf8')
    await writeFile(projectArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'project-run',
      candidateId: 'project-candidate',
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 0,
      maxArtifacts: 1
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-102' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:10:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'user-policy.json', policyArtifactFile: 'project-policy.json' }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-102', messageID: 'message-102' },
      { message: 'Inspect project policy precedence.' }
    )

    expect(startTask).toHaveBeenCalledWith(expect.objectContaining({
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 0,
      maxArtifacts: 1,
      policyIdentity: {
        runId: 'project-run',
        candidateId: 'project-candidate',
        sourceScope: 'project',
        artifactFile: projectArtifactFile
      }
    }))
  })

  it('loads a configured project policy artifact when the configured user policy artifact is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const projectArtifactFile = join(directory, 'project-policy.json')
    await writeFile(projectArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'project-run',
      candidateId: 'project-candidate',
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 0,
      maxArtifacts: 1
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-106' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:35:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'missing-user-policy.json', policyArtifactFile: 'project-policy.json' }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-106', messageID: 'message-106' },
      { message: 'Inspect project policy precedence over missing user policy.' }
    )

    expect(startTask).toHaveBeenCalledWith(expect.objectContaining({
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 0,
      maxArtifacts: 1,
      policyIdentity: {
        runId: 'project-run',
        candidateId: 'project-candidate',
        sourceScope: 'project',
        artifactFile: projectArtifactFile
      }
    }))
  })

  it('loads a configured project policy artifact when the configured user policy artifact is malformed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const malformedUserArtifactFile = join(directory, 'malformed-user-policy.json')
    const projectArtifactFile = join(directory, 'project-policy.json')
    await writeFile(malformedUserArtifactFile, JSON.stringify({ runId: '', policy: {} }), 'utf8')
    await writeFile(projectArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'project-run',
      candidateId: 'project-candidate',
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 2,
      maxArtifacts: 0
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-107' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:40:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'malformed-user-policy.json', policyArtifactFile: 'project-policy.json' }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-107', messageID: 'message-107' },
      { message: 'Inspect project policy precedence over malformed user policy.' }
    )

    expect(startTask).toHaveBeenCalledWith(expect.objectContaining({
      policyInput: { routing: { buildPromptMode: 'prefer-codegen' } },
      maxMemories: 2,
      maxArtifacts: 0,
      policyIdentity: {
        runId: 'project-run',
        candidateId: 'project-candidate',
        sourceScope: 'project',
        artifactFile: projectArtifactFile
      }
    }))
  })

  it('forwards active policy into retrieval inspection, compaction, and task-end hooks', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const projectArtifactFile = join(directory, 'project-policy.json')
    const policyInput = { routing: { buildPromptMode: 'prefer-codegen' } }
    await writeFile(projectArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'project-run',
      candidateId: 'project-candidate',
      policyInput,
      maxMemories: 2,
      maxArtifacts: 1
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({
      taskId: 'message-104',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1']
    }))
    const inspectRetrieval = vi.fn().mockResolvedValue(undefined)
    const compactSession = vi.fn().mockResolvedValue(undefined)
    const endTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, inspectRetrieval, compactSession, endTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:25:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { policyArtifactFile: 'project-policy.json' }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-104', messageID: 'message-104' },
      { message: 'Inspect downstream policy forwarding.' }
    )
    await hooks['tool.execute.before']?.({
      sessionID: 'session-104',
      callID: 'call-read',
      tool: 'read'
    }, {
      args: { filePath: '/repo/src/index.ts' }
    })
    await hooks['experimental.session.compacting']?.(
      { sessionID: 'session-104' },
      { context: ['ctx-1'] }
    )
    await hooks.event?.({ event: { type: 'session.status', properties: { sessionID: 'session-104', status: { type: 'idle' } } } })

    const policyIdentity = {
      runId: 'project-run',
      candidateId: 'project-candidate',
      sourceScope: 'project',
      artifactFile: projectArtifactFile
    }
    expect(inspectRetrieval).toHaveBeenCalledWith(expect.objectContaining({
      policyInput,
      policyIdentity,
      maxMemories: 2,
      maxArtifacts: 1
    }))
    expect(compactSession).toHaveBeenCalledWith(expect.objectContaining({ policyInput, policyIdentity }))
    expect(endTask).toHaveBeenCalledWith(expect.objectContaining({ policyInput, policyIdentity }))
  })

  it('forwards active policy context limits into retrieval inspection hook input', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const projectArtifactFile = join(directory, 'project-policy.json')
    await writeFile(projectArtifactFile, JSON.stringify(runtimePolicyArtifact({
      runId: 'project-run',
      candidateId: 'project-candidate',
      policyInput: { retrieval: { repoMatchWeight: 10 } },
      maxMemories: 4,
      maxArtifacts: 2
    })), 'utf8')

    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-105' }))
    const inspectRetrieval = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, inspectRetrieval })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:30:00.000Z' })
    const hooks = await plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { policyArtifactFile: 'project-policy.json' }
    )

    await hooks['chat.message']?.(
      { sessionID: 'session-105', messageID: 'message-105' },
      { message: 'Inspect retrieval limits forwarding.' }
    )
    await hooks['tool.execute.before']?.({
      sessionID: 'session-105',
      callID: 'call-read',
      tool: 'read'
    }, {
      args: { filePath: '/repo/src/index.ts' }
    })

    expect(inspectRetrieval).toHaveBeenCalledWith(expect.objectContaining({
      repoId: 'repo-alpha',
      taskId: 'message-105',
      taskText: 'Inspect retrieval limits forwarding.',
      taskType: 'analysis',
      maxMemories: 4,
      maxArtifacts: 2
    }))
  })

  it('throws startup errors that name missing and malformed configured policy artifact options', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-plugin-'))
    tempDirectories.push(directory)
    const malformedArtifactFile = join(directory, 'malformed-policy.json')
    await writeFile(malformedArtifactFile, JSON.stringify({ runId: '', policy: {} }), 'utf8')

    const plugin = createOpenCodePlugin({ createAdapter: vi.fn(), now: () => '2026-04-22T16:15:00.000Z' })

    await expect(plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'missing-policy.json' }
    )).rejects.toThrow(`userPolicyArtifactFile ${join(directory, 'missing-policy.json')}`)
    await expect(plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { userPolicyArtifactFile: 'malformed-policy.json' }
    )).rejects.toThrow(`userPolicyArtifactFile ${malformedArtifactFile}`)
    await expect(plugin.server(
      { project: { id: 'repo-alpha' }, directory },
      { policyArtifactFile: 'malformed-policy.json' }
    )).rejects.toThrow(`policyArtifactFile ${malformedArtifactFile}`)
  })

  it('keeps policy disabled without warning when no policy artifact option is configured', async () => {
    const startTask = vi.fn().mockResolvedValue(createStartTaskResult({ taskId: 'message-103' }))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T16:20:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-103', messageID: 'message-103' },
      { message: 'Inspect no-policy startup.' }
    )

    expect(startTask).toHaveBeenCalledWith(expect.not.objectContaining({
      policyInput: expect.anything(),
      policyIdentity: expect.anything()
    }))
  })

  it('falls back to derived ids and text parts when message metadata is partial', async () => {
    const startTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:05:00.000Z' })
    const hooks = await plugin.server({ project: { name: 'repo-beta' }, directory: '/tmp/repo-beta' })

    await hooks['chat.message']?.(
      { sessionID: 'session-002' },
      { parts: [{ text: 'Inspect host integration' }, { content: 'and keep adapters thin.' }] }
    )

    expect(startTask).toHaveBeenCalledWith({
      packetId: 'session-002:2026-04-22T15:05:00.000Z:packet',
      repoId: 'repo-beta',
      taskId: 'session-002:2026-04-22T15:05:00.000Z:chat-message',
      taskText: 'Inspect host integration\nand keep adapters thin.',
      taskType: 'analysis',
      prompt: 'Inspect host integration\nand keep adapters thin.',
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-22T15:05:00.000Z'
    })
  })

  it('swallows adapter failures so the host chat flow is not broken', async () => {
    const startTask = vi.fn().mockRejectedValue(new Error('disk full'))
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:10:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await expect(
      hooks['chat.message']?.(
        { sessionID: 'session-003', messageID: 'message-003' },
        { message: 'This should not break host chat flow.' }
      )
    ).resolves.toBeUndefined()

    expect(startTask).toHaveBeenCalledTimes(1)
  })

  it('routes retrieval-like tool.execute.before hooks into adapter.inspectRetrieval using the tracked task context', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-010.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-010/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:12:00.000Z',
          verificationState: { status: 'pending', checklist: [], completedSteps: [] },
          unresolvedQuestions: []
        },
        context: {
          taskId: 'message-010',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: [],
            selectedArtifactIds: []
          }
        }
      }
    })
    const inspectRetrieval = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, inspectRetrieval })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:12:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-020', messageID: 'message-010' },
      { message: 'Inspect retrieval hook wiring.' }
    )
    await hooks['tool.execute.before']?.({
      sessionID: 'session-020',
      callID: 'call-read',
      tool: 'read'
    }, {
      args: { filePath: '/repo/src/index.ts', offset: 1, limit: 50 }
    })

    expect(inspectRetrieval).toHaveBeenCalledWith({
      repoId: 'repo-alpha',
      taskId: 'message-010',
      taskText: 'Inspect retrieval hook wiring.',
      taskType: 'analysis',
      policyInput: undefined,
      rankedMemories: [],
      rankedArtifacts: []
    })
  })

  it('ignores unrelated tool.execute.before hooks for retrieval inspection', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-011.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-011/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:13:00.000Z',
          verificationState: { status: 'pending', checklist: [], completedSteps: [] },
          unresolvedQuestions: []
        },
        context: {
          taskId: 'message-011',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: [],
            selectedArtifactIds: []
          }
        }
      }
    })
    const inspectRetrieval = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, inspectRetrieval })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:13:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-021', messageID: 'message-011' },
      { message: 'Inspect unrelated tool hook wiring.' }
    )
    await hooks['tool.execute.before']?.({
      sessionID: 'session-021',
      callID: 'call-bash',
      tool: 'bash'
    }, {
      args: { command: 'pnpm test' }
    })

    expect(inspectRetrieval).not.toHaveBeenCalled()
  })

  it('swallows retrieval inspection failures so tool hooks remain observational', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-012.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-012/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:14:00.000Z',
          verificationState: { status: 'pending', checklist: [], completedSteps: [] },
          unresolvedQuestions: []
        },
        context: {
          taskId: 'message-012',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: [],
            selectedArtifactIds: []
          }
        }
      }
    })
    const inspectRetrieval = vi.fn().mockRejectedValue(new Error('adapter unavailable'))
    const createAdapter = vi.fn().mockReturnValue({ startTask, inspectRetrieval })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:14:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-022', messageID: 'message-012' },
      { message: 'Inspect retrieval failure handling.' }
    )

    await expect(hooks['tool.execute.before']?.({
      sessionID: 'session-022',
      callID: 'call-webfetch',
      tool: 'webfetch'
    }, {
      args: { url: 'https://example.com', format: 'markdown' }
    })).resolves.toBeUndefined()

    expect(inspectRetrieval).toHaveBeenCalledTimes(1)
  })

  it('derives a shadow task-end call from session.status idle using the tracked session task', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-001.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-001/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:20:00.000Z',
          verificationState: { status: 'pending', checklist: ['Capture evidence'], completedSteps: [] },
          unresolvedQuestions: []
        },
        context: {
          taskId: 'message-001',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: ['memory-1'],
            selectedArtifactIds: ['artifact-1']
          }
        }
      }
    })
    const endTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, endTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:25:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-010', messageID: 'message-001' },
      { message: 'Inspect the task-end host integration boundary.' }
    )
    await hooks.event?.({ event: { type: 'session.status', properties: { sessionID: 'session-010', status: { type: 'idle' } } } })

    expect(endTask).toHaveBeenCalledWith({
      id: 'message-001:end',
      repoId: 'repo-alpha',
      taskId: 'message-001',
      taskText: 'Inspect the task-end host integration boundary.',
      taskType: 'analysis',
      promptSummary: 'Inspect the task-end host integration boundary.',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'explore',
      verificationState: { status: 'pending', checklist: ['Capture evidence'], completedSteps: [] },
      unresolvedQuestions: [],
      filesInspected: [],
      filesChanged: [],
      commands: [],
      diagnostics: ['Derived from OpenCode session idle signal.'],
      outcome: 'partial',
      tags: ['opencode', 'host-integration', 'session.status'],
      startedAt: '2026-04-22T15:20:00.000Z',
      endedAt: '2026-04-22T15:25:00.000Z'
    })
  })

  it('supports session.idle as a compatibility fallback signal', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-002.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-002/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:30:00.000Z',
          verificationState: { status: 'pending', checklist: [], completedSteps: [] },
          unresolvedQuestions: []
        },
        context: {
          taskId: 'message-002',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: [],
            selectedArtifactIds: []
          }
        }
      }
    })
    const endTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, endTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:35:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-011', messageID: 'message-002' },
      { message: 'Inspect idle fallback.' }
    )
    await hooks.event?.({ event: { type: 'session.idle', properties: { sessionID: 'session-011' } } })

    expect(endTask).toHaveBeenCalledTimes(1)
  })

  it('derives a shadow compaction call from experimental.session.compacting using the tracked task', async () => {
    const startTask = vi.fn().mockResolvedValue({
      filePath: '/tmp/store/data/runtime/task-start/repo-alpha/message-003.json',
      observabilityFilePath: '/tmp/store/data/runtime/adapter-events/opencode/repo-alpha/message-003/task-start.json',
      result: {
        taskStart: {
          startedAt: '2026-04-22T15:40:00.000Z',
          verificationState: { status: 'pending', checklist: ['Capture evidence'], completedSteps: [] },
          unresolvedQuestions: ['Should the smoke test run against staging?']
        },
        context: {
          taskId: 'message-003',
          packet: {
            taskType: 'analysis',
            suggestedRoute: 'explore',
            selectedMemoryIds: ['memory-1'],
            selectedArtifactIds: ['artifact-1']
          }
        }
      }
    })
    const compactSession = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask, compactSession })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:45:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-012', messageID: 'message-003' },
      { message: 'Inspect the compaction host integration boundary.' }
    )
    await hooks['experimental.session.compacting']?.(
      { sessionID: 'session-012' },
      { context: ['ctx-1'], prompt: 'Summarize the compaction boundary.' }
    )

    expect(compactSession).toHaveBeenCalledWith({
      repoId: 'repo-alpha',
      taskId: 'message-003',
      taskText: 'Summarize the compaction boundary.',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'explore',
      verificationState: { status: 'pending', checklist: ['Capture evidence'], completedSteps: [] },
      unresolvedQuestions: ['Should the smoke test run against staging?'],
      startedAt: '2026-04-22T15:40:00.000Z',
      endedAt: '2026-04-22T15:45:00.000Z',
      compactedAt: '2026-04-22T15:45:00.000Z'
    })
  })
})
