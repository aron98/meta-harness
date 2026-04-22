import { describe, expect, it, vi } from 'vitest'

import { createOpenCodePlugin } from '../src/index'

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
    const startTask = vi.fn().mockResolvedValue(undefined)
    const createAdapter = vi.fn().mockReturnValue({ startTask })

    const plugin = createOpenCodePlugin({ createAdapter, now: () => '2026-04-22T15:00:00.000Z' })
    const hooks = await plugin.server({ project: { id: 'repo-alpha' }, directory: '/tmp/repo-alpha' })

    await hooks['chat.message']?.(
      { sessionID: 'session-001', messageID: 'message-001' },
      { message: 'Please inspect the new OpenCode plugin integration boundary.' }
    )

    expect(createAdapter).toHaveBeenCalledWith({ dataRoot: '/tmp/repo-alpha' })
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
