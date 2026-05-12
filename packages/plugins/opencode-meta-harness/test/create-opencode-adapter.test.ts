import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpenCodeAdapter } from '../src/index'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })))
})

describe('createOpenCodeAdapter', () => {
  it('creates stable adapter metadata with host id opencode', () => {
    const adapter = createOpenCodeAdapter({ dataRoot: '/tmp/meta-harness-opencode' })

    expect(adapter.metadata).toEqual({
      host: 'opencode',
      kind: 'plugin-adapter',
      packageName: '@meta-harness/opencode-meta-harness',
      pluginCorePackageName: '@meta-harness/plugin-core'
    })
  })

  it('maps task-start input, delegates through plugin-core, writes runtime output, and writes observability', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-adapter-'))
    tempDirectories.push(dataRoot)

    const createSession = vi.fn().mockReturnValue({
      taskStart: { id: 'packet-001-start' },
      context: {
        repoId: 'repo-a',
        taskId: 'task-001',
        packet: {
          id: 'packet-001',
          selectedMemoryIds: ['memory-1'],
          selectedArtifactIds: ['artifact-1']
        },
        createdAt: '2026-04-21T12:00:00.000Z'
      }
    })
    const writeTaskStart = vi.fn().mockResolvedValue(join(dataRoot, 'data/runtime/task-start/repo-a/task-001.json'))
    const writeObservability = vi.fn().mockResolvedValue(join(dataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json'))
    const adapter = createOpenCodeAdapter({ dataRoot, createSession, writeTaskStart, writeObservability })

    const result = await adapter.startTask({
      packetId: 'packet-001',
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      prompt: 'Inspect runtime flow',
      runtimeRoots: { userDataRoot: dataRoot },
      userMemoryRecords: [],
      userArtifactRecords: [],
      referenceTime: '2026-04-21T12:00:00.000Z',
      policyInput: {
        routing: {
          buildPromptMode: 'prefer-codegen'
        }
      }
    })

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      packetId: 'packet-001',
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      policyInput: {
        routing: {
          buildPromptMode: 'prefer-codegen'
        }
      }
    }))
    expect(writeTaskStart).toHaveBeenCalledTimes(1)
    expect(writeObservability).toHaveBeenCalledTimes(1)
    expect(result.filePath).toContain('data/runtime/task-start/repo-a/task-001.json')
    expect(result.observabilityFilePath).toContain('data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json')
  })

  it('forwards policy identity into task-start observability records when supplied', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-adapter-'))
    tempDirectories.push(dataRoot)

    const createSession = vi.fn().mockReturnValue({
      taskStart: { id: 'packet-001-start' },
      context: {
        repoId: 'repo-a',
        taskId: 'task-001',
        packet: {
          id: 'packet-001',
          selectedMemoryIds: [],
          selectedArtifactIds: []
        },
        createdAt: '2026-04-21T12:00:00.000Z'
      },
      adapterMetadata: {
        runtimeRoots: { userDataRoot: dataRoot },
        selectedMemorySources: [],
        selectedArtifactSources: [],
        policyIdentity: {
          runId: 'run-001',
          candidateId: 'candidate-001',
          sourceScope: 'project' as const,
          artifactFile: '/repo/.opencode/meta-harness/policies/winner-policy.json'
        }
      }
    })
    const writeObservability = vi.fn().mockResolvedValue(join(dataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json'))
    const adapter = createOpenCodeAdapter({ dataRoot, createSession, writeObservability })

    await adapter.startTask({
      packetId: 'packet-001',
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      prompt: 'Inspect runtime flow',
      runtimeRoots: { userDataRoot: dataRoot },
      userMemoryRecords: [],
      userArtifactRecords: [],
      referenceTime: '2026-04-21T12:00:00.000Z',
      policyInput: {
        routing: {
          buildPromptMode: 'prefer-codegen'
        }
      },
      policyIdentity: {
        runId: 'run-001',
        candidateId: 'candidate-001',
        sourceScope: 'project' as const,
        artifactFile: '/repo/.opencode/meta-harness/policies/winner-policy.json'
      }
    })

    expect(writeObservability).toHaveBeenCalledWith(dataRoot, expect.objectContaining({
      operation: 'task-start',
      policyInputSupplied: true,
      policyRunId: 'run-001',
      policyCandidateId: 'candidate-001',
      policySourceScope: 'project',
      policyArtifactFile: '/repo/.opencode/meta-harness/policies/winner-policy.json'
    }))
  })

  it('writes task-start runtime and observability records to project data root from task-start metadata', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-user-'))
    const projectDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-project-'))
    tempDirectories.push(userDataRoot, projectDataRoot)

    const createSession = vi.fn().mockReturnValue({
      taskStart: { id: 'packet-001-start' },
      context: {
        repoId: 'repo-a',
        taskId: 'task-001',
        packet: {
          id: 'packet-001',
          selectedMemoryIds: [],
          selectedArtifactIds: []
        },
        createdAt: '2026-04-21T12:00:00.000Z'
      },
      adapterMetadata: {
        runtimeRoots: { userDataRoot, projectDataRoot },
        selectedMemorySources: [],
        selectedArtifactSources: []
      }
    })
    const writeTaskStart = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/runtime/task-start/repo-a/task-001.json'))
    const writeObservability = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json'))
    const adapter = createOpenCodeAdapter({ dataRoot: userDataRoot, createSession, writeTaskStart, writeObservability })

    await adapter.startTask({
      packetId: 'packet-001',
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      prompt: 'Inspect runtime flow',
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-21T12:00:00.000Z'
    })

    expect(writeTaskStart).toHaveBeenCalledWith(expect.objectContaining({
      dataRoot: projectDataRoot,
      context: expect.objectContaining({ taskId: 'task-001' })
    }))
    expect(writeObservability).toHaveBeenCalledWith(projectDataRoot, expect.objectContaining({ operation: 'task-start' }))
  })

  it('writes task-start runtime and observability records to user data root when project data root is absent', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-user-'))
    tempDirectories.push(userDataRoot)

    const createSession = vi.fn().mockReturnValue({
      taskStart: { id: 'packet-001-start' },
      context: {
        repoId: 'repo-a',
        taskId: 'task-001',
        packet: {
          id: 'packet-001',
          selectedMemoryIds: [],
          selectedArtifactIds: []
        },
        createdAt: '2026-04-21T12:00:00.000Z'
      },
      adapterMetadata: {
        runtimeRoots: { userDataRoot },
        selectedMemorySources: [],
        selectedArtifactSources: []
      }
    })
    const writeTaskStart = vi.fn().mockResolvedValue(join(userDataRoot, 'data/runtime/task-start/repo-a/task-001.json'))
    const writeObservability = vi.fn().mockResolvedValue(join(userDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-start.json'))
    const adapter = createOpenCodeAdapter({ dataRoot: userDataRoot, createSession, writeTaskStart, writeObservability })

    await adapter.startTask({
      packetId: 'packet-001',
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      prompt: 'Inspect runtime flow',
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-21T12:00:00.000Z'
    })

    expect(writeTaskStart).toHaveBeenCalledWith(expect.objectContaining({
      dataRoot: userDataRoot,
      context: expect.objectContaining({ taskId: 'task-001' })
    }))
    expect(writeObservability).toHaveBeenCalledWith(userDataRoot, expect.objectContaining({ operation: 'task-start' }))
  })

  it('writes inspect-retrieval observability records to project data root when configured', async () => {
    const userDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-user-'))
    const projectDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-project-'))
    tempDirectories.push(userDataRoot, projectDataRoot)

    const inspectRetrievalResult = vi.fn().mockReturnValue({ selectedMemories: [], selectedArtifacts: [] })
    const writeObservability = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/inspect-retrieval.json'))
    const adapter = createOpenCodeAdapter({
      dataRoot: userDataRoot,
      runtimeRoots: { userDataRoot, projectDataRoot },
      inspectRetrievalResult,
      writeObservability
    })

    await adapter.inspectRetrieval({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      rankedMemories: [],
      rankedArtifacts: []
    })

    expect(writeObservability).toHaveBeenCalledWith(projectDataRoot, expect.objectContaining({ operation: 'inspect-retrieval' }))
  })

  it('maps task-end, retrieval inspection, and compaction without interpreting policy input', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-adapter-'))
    const projectDataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-opencode-project-'))
    tempDirectories.push(dataRoot, projectDataRoot)

    const createArtifact = vi.fn().mockReturnValue({ id: 'artifact-1', repoId: 'repo-a' })
    const inspectRetrievalResult = vi.fn().mockReturnValue({ selectedMemories: [], selectedArtifacts: [] })
    const compactSessionResult = vi.fn().mockReturnValue({
      repoId: 'repo-a',
      taskId: 'task-001',
      selectedMemoryIds: [],
      selectedArtifactIds: [],
      suggestedRoute: 'verify',
      verificationState: { status: 'passed', checklist: [], completedSteps: [] },
      unresolvedQuestions: [],
      taskText: 'Inspect runtime flow',
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:05:00.000Z',
      compactedAt: '2026-04-21T12:06:00.000Z'
    })
    const writeTaskEnd = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/runtime/task-end/repo-a/task-001.json'))
    const writeArtifact = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/artifacts/repo-a/artifact-1.json'))
    const writeCompaction = vi.fn().mockResolvedValue(join(projectDataRoot, 'data/runtime/compaction/repo-a/task-001.json'))
    const writeObservability = vi
      .fn()
      .mockResolvedValueOnce(join(projectDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/task-end.json'))
      .mockResolvedValueOnce(join(projectDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/inspect-retrieval.json'))
      .mockResolvedValueOnce(join(projectDataRoot, 'data/runtime/adapter-events/opencode/repo-a/task-001/compact-session.json'))

    const adapter = createOpenCodeAdapter({
      dataRoot,
      runtimeRoots: { userDataRoot: dataRoot, projectDataRoot },
      createArtifact,
      inspectRetrievalResult,
      compactSessionResult,
      writeTaskEnd,
      writeArtifact,
      writeCompaction,
      writeObservability
    })

    await adapter.endTask({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      promptSummary: 'Inspected runtime flow',
      suggestedRoute: 'explore',
      selectedMemoryIds: [],
      selectedArtifactIds: [],
      verificationState: { status: 'passed', checklist: [], completedSteps: [] },
      unresolvedQuestions: [],
      filesInspected: [],
      filesChanged: [],
      commands: [],
      diagnostics: [],
      outcome: 'success',
      tags: [],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:05:00.000Z',
      policyInput: {
        retrieval: {
          repoMatchWeight: 20
        }
      },
      id: 'task-end-001'
    })

    await adapter.inspectRetrieval({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      rankedMemories: [],
      rankedArtifacts: []
    })

    await adapter.compactSession({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      suggestedRoute: 'verify',
      selectedMemoryIds: [],
      selectedArtifactIds: [],
      verificationState: { status: 'passed', checklist: [], completedSteps: [] },
      unresolvedQuestions: [],
      startedAt: '2026-04-21T12:00:00.000Z',
      endedAt: '2026-04-21T12:05:00.000Z',
      compactedAt: '2026-04-21T12:06:00.000Z'
    })

    expect(createArtifact).toHaveBeenCalledTimes(1)
    expect(inspectRetrievalResult).toHaveBeenCalledTimes(1)
    expect(compactSessionResult).toHaveBeenCalledTimes(1)
    expect(writeTaskEnd).toHaveBeenCalledTimes(1)
    expect(writeArtifact).toHaveBeenCalledTimes(1)
    expect(writeCompaction).toHaveBeenCalledTimes(1)
    expect(writeObservability).toHaveBeenCalledTimes(3)
    expect(writeTaskEnd).toHaveBeenCalledWith(expect.objectContaining({ dataRoot: projectDataRoot }))
    expect(writeArtifact).toHaveBeenCalledWith(projectDataRoot, expect.objectContaining({ id: 'artifact-1' }))
    expect(writeCompaction).toHaveBeenCalledWith(expect.objectContaining({ dataRoot: projectDataRoot }))
    expect(writeObservability).toHaveBeenNthCalledWith(1, projectDataRoot, expect.objectContaining({ operation: 'task-end' }))
    expect(writeObservability).toHaveBeenNthCalledWith(2, projectDataRoot, expect.objectContaining({ operation: 'inspect-retrieval' }))
    expect(writeObservability).toHaveBeenNthCalledWith(3, projectDataRoot, expect.objectContaining({ operation: 'compact-session' }))
  })
})
