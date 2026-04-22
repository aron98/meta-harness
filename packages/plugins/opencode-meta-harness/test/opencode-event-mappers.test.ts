import { describe, expect, it } from 'vitest'

import {
  mapOpenCodeCompactionPayload,
  mapOpenCodeInspectRetrievalPayload,
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
})
