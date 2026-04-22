import { describe, expect, it } from 'vitest'

import {
  mapOpenCodeCompactionPayload,
  mapOpenCodeInspectRetrievalPayload,
  mapOpenCodeToolExecuteRetrievalSignal,
  mapOpenCodeTaskEndPayload,
  mapOpenCodeTaskStartPayload
} from '../src/index'

describe('OpenCode event mappers', () => {
  it('maps OpenCode payloads into host-neutral adapter input shapes', () => {
    const policyInput = {
      verification: {
        includeArtifactVerificationCommands: true
      }
    }

    expect(mapOpenCodeTaskStartPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis', policyInput })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput
    })

    expect(mapOpenCodeTaskEndPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis', promptSummary: 'Inspected runtime flow', suggestedRoute: 'explore', policyInput })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      promptSummary: 'Inspected runtime flow',
      suggestedRoute: 'explore',
      policyInput
    })

    expect(mapOpenCodeInspectRetrievalPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis' })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput: undefined
    })

    expect(mapOpenCodeCompactionPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', suggestedRoute: 'verify' })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      suggestedRoute: 'verify',
      policyInput: undefined
    })
  })

  it('translates names and values only, without interpreting policy decisions', () => {
    const payload = {
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput: {
        routing: {
          buildPromptMode: 'prefer-codegen'
        }
      }
    }

    const mapped = mapOpenCodeTaskStartPayload(payload)

    expect(mapped.policyInput).toEqual(payload.policyInput)
    expect(mapped.policyInput).toBe(payload.policyInput)
  })

  it('maps a retrieval-like tool.execute signal into the existing inspectRetrieval seam with minimal fields', () => {
    const policyInput = {
      retrieval: {
        repoMatchWeight: 20
      }
    }

    expect(mapOpenCodeToolExecuteRetrievalSignal(
      {
        sessionID: 'session-001',
        callID: 'call-read',
        toolName: 'read',
        arguments: { filePath: '/repo/src/index.ts', offset: 1, limit: 50 }
      },
      {
        repoId: 'repo-a',
        taskId: 'task-001',
        taskText: 'Inspect runtime flow',
        taskType: 'analysis',
        policyInput
      }
    )).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput,
      rankedMemories: [],
      rankedArtifacts: []
    })
  })

  it('keeps the heuristic mapping observational for other supported retrieval-like tool names too', () => {
    expect(mapOpenCodeToolExecuteRetrievalSignal(
      {
        sessionID: 'session-001',
        callID: 'call-grep',
        toolName: 'grep',
        arguments: { pattern: 'inspectRetrieval', include: '*.ts' }
      },
      {
        repoId: 'repo-a',
        taskId: 'task-001',
        taskText: 'Inspect runtime flow',
        taskType: 'analysis'
      }
    )).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput: undefined,
      rankedMemories: [],
      rankedArtifacts: []
    })
  })
})
