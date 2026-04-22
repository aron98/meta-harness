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
})
