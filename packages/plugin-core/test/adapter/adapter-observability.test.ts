import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import {
  parseAdapterObservabilityRecord,
  writeAdapterObservabilityRecord
} from '../../src/index'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })))
})

describe('adapter observability', () => {
  it('writes bounded hook records under the adapter-events runtime path', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-plugin-core-observability-'))
    tempDirectories.push(dataRoot)

    const filePath = await writeAdapterObservabilityRecord(dataRoot, {
      hostId: 'opencode',
      hookName: 'task:start',
      operation: 'task-start',
      repoId: 'repo-a',
      taskId: 'task-001',
      packetId: 'packet-001',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      policyInputSupplied: true,
      status: 'success',
      warningMessages: ['warning: skipped memory record ignored.json'],
      createdAt: '2026-04-21T12:00:00.000Z'
    })

    expect(filePath).toBe(join(dataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json'))
    await expect(readFile(filePath, 'utf8')).resolves.toContain('task:start')
    await expect(readFile(filePath, 'utf8')).resolves.toContain('warning: skipped memory record ignored.json')
  })

  it('rejects invalid host ids and unknown payload fields', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-plugin-core-observability-'))
    tempDirectories.push(dataRoot)

    await expect(
      writeAdapterObservabilityRecord(dataRoot, {
        hostId: '../escape',
        hookName: 'task:start',
        operation: 'task-start',
        repoId: 'repo-a',
        taskId: 'task-001',
        selectedMemoryIds: [],
        selectedArtifactIds: [],
        policyInputSupplied: false,
        status: 'success',
        createdAt: '2026-04-21T12:00:00.000Z'
      })
    ).rejects.toThrowError(/must be a single path segment/i)

    expect(() =>
      parseAdapterObservabilityRecord({
        hostId: 'opencode',
        hookName: 'task:start',
        operation: 'task-start',
        repoId: 'repo-a',
        taskId: 'task-001',
        selectedMemoryIds: [],
        selectedArtifactIds: [],
        policyInputSupplied: false,
        status: 'success',
        createdAt: '2026-04-21T12:00:00.000Z',
        unsupported: true
      })
    ).toThrowError()
  })
})
