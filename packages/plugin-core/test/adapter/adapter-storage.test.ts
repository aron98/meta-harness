import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import type { CompactionSummary, RuntimeTaskContext, TaskEndEvent } from '@meta-harness/core'

import {
  writeAdapterCompactionRecord,
  writeAdapterTaskEndRecord,
  writeAdapterTaskStartRecord
} from '../../src/index'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })))
})

function createRuntimeTaskContext(taskId = 'task-001'): RuntimeTaskContext {
  return {
    repoId: 'repo-a',
    taskId,
    prompt: 'Inspect the runtime boundary.',
    packet: {
      id: 'packet-001',
      repoId: 'repo-a',
      taskId,
      taskType: 'analysis',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'explore',
      verificationChecklist: ['Confirm the findings are supported by inspected evidence.'],
      rationale: 'Selected 1 memories and 1 artifacts for repo repo-a based on task type analysis, structured tag overlap, and recency.',
      createdAt: '2026-04-21T12:00:00.000Z'
    },
    selectedMemories: [{
      id: 'memory-1',
      scope: 'repo-local',
      repoId: 'repo-a',
      kind: 'summary',
      value: 'Inspect package metadata first.',
      source: 'human-input',
      sourceArtifactIds: [],
      confidence: 'high',
      createdAt: '2026-04-21T11:00:00.000Z',
      updatedAt: '2026-04-21T11:00:00.000Z'
    }],
    selectedArtifacts: [{
      id: 'artifact-1',
      taskType: 'analysis',
      repoId: 'repo-a',
      promptSummary: 'Inspect repository structure',
      filesInspected: ['package.json'],
      filesChanged: [],
      commands: ['pnpm test'],
      diagnostics: [],
      verification: ['pnpm test'],
      outcome: 'success',
      tags: ['repo', 'inspection'],
      createdAt: '2026-04-21T10:00:00.000Z'
    }],
    taskStart: {
      id: 'packet-001-start',
      repoId: 'repo-a',
      taskId,
      taskType: 'analysis',
      taskText: 'Inspect the runtime boundary.',
      selectedMemoryIds: ['memory-1'],
      selectedArtifactIds: ['artifact-1'],
      suggestedRoute: 'explore',
      verificationState: {
        status: 'pending',
        checklist: ['Confirm the findings are supported by inspected evidence.'],
        completedSteps: []
      },
      unresolvedQuestions: [],
      createdAt: '2026-04-21T12:00:00.000Z',
      startedAt: '2026-04-21T12:00:00.000Z'
    },
    verificationState: {
      status: 'pending',
      checklist: ['Confirm the findings are supported by inspected evidence.'],
      completedSteps: []
    },
    unresolvedQuestions: [],
    createdAt: '2026-04-21T12:00:00.000Z'
  }
}

function createTaskEndEvent(taskId = 'task-001'): TaskEndEvent {
  return {
    id: 'task-end-001',
    repoId: 'repo-a',
    taskId,
    taskType: 'analysis',
    taskText: 'Inspect the runtime boundary.',
    promptSummary: 'Inspected the runtime boundary.',
    selectedMemoryIds: ['memory-1'],
    selectedArtifactIds: ['artifact-1'],
    suggestedRoute: 'explore',
    verificationState: {
      status: 'passed',
      checklist: ['Confirm the findings are supported by inspected evidence.'],
      completedSteps: ['Confirm the findings are supported by inspected evidence.']
    },
    unresolvedQuestions: [],
    filesInspected: ['package.json'],
    filesChanged: [],
    commands: ['pnpm test'],
    diagnostics: ['inspected boundary'],
    outcome: 'success',
    tags: ['repo', 'inspection'],
    startedAt: '2026-04-21T12:00:00.000Z',
    endedAt: '2026-04-21T12:05:00.000Z'
  }
}

function createCompactionSummary(taskId = 'task-001'): CompactionSummary {
  return {
    repoId: 'repo-a',
    taskId,
    taskText: 'Inspect the runtime boundary.',
    selectedMemoryIds: ['memory-1'],
    selectedArtifactIds: ['artifact-1'],
    suggestedRoute: 'explore',
    verificationState: {
      status: 'passed',
      checklist: ['Confirm the findings are supported by inspected evidence.'],
      completedSteps: ['Confirm the findings are supported by inspected evidence.']
    },
    unresolvedQuestions: [],
    compactedAt: '2026-04-21T12:06:00.000Z',
    startedAt: '2026-04-21T12:00:00.000Z',
    endedAt: '2026-04-21T12:05:00.000Z'
  }
}

describe('adapter storage', () => {
  it('writes task-start, task-end, and compaction records through shared runtime conventions', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-plugin-core-storage-'))
    tempDirectories.push(dataRoot)

    const startPath = await writeAdapterTaskStartRecord({ dataRoot, context: createRuntimeTaskContext() })
    const endPath = await writeAdapterTaskEndRecord({ dataRoot, event: createTaskEndEvent() })
    const compactionPath = await writeAdapterCompactionRecord({ dataRoot, summary: createCompactionSummary() })

    expect(startPath).toBe(join(dataRoot, 'data/runtime/task-start/repo-a/task-001.json'))
    expect(endPath).toBe(join(dataRoot, 'data/runtime/task-end/repo-a/task-001.json'))
    expect(compactionPath).toBe(join(dataRoot, 'data/runtime/compaction/repo-a/task-001.json'))
    await expect(readFile(startPath, 'utf8')).resolves.toContain('packet-001')
    await expect(readFile(endPath, 'utf8')).resolves.toContain('task-end-001')
    await expect(readFile(compactionPath, 'utf8')).resolves.toContain('Inspect the runtime boundary.')
  })

  it('rejects invalid repo or task path segments', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-plugin-core-storage-'))
    tempDirectories.push(dataRoot)

    await expect(
      writeAdapterTaskStartRecord({ dataRoot, context: createRuntimeTaskContext('../escape') })
    ).rejects.toThrowError(/must be a single path segment/i)
    await expect(
      writeAdapterTaskEndRecord({ dataRoot, event: { ...createTaskEndEvent(), repoId: 'repo/a' } })
    ).rejects.toThrowError(/must be a single path segment/i)
  })
})
