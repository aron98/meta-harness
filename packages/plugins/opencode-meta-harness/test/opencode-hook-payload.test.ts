import { describe, expect, it } from 'vitest'

import {
  parseOpenCodeCompactionPayload,
  parseOpenCodeInspectRetrievalPayload,
  parseOpenCodeTaskEndPayload,
  parseOpenCodeTaskStartPayload
} from '../src/index'

describe('OpenCode hook payload parsing', () => {
  it('parses the minimal payloads for task start, task end, retrieval inspection, and compaction', () => {
    const policyInput = {
      retrieval: {
        repoMatchWeight: 20
      }
    }

    expect(parseOpenCodeTaskStartPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis', policyInput })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput
    })

    expect(parseOpenCodeTaskEndPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis', promptSummary: 'Inspected runtime flow', suggestedRoute: 'explore' })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      promptSummary: 'Inspected runtime flow',
      suggestedRoute: 'explore',
      policyInput: undefined
    })

    expect(parseOpenCodeInspectRetrievalPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis' })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      taskType: 'analysis',
      policyInput: undefined
    })

    expect(parseOpenCodeCompactionPayload({ repoId: 'repo-a', taskId: 'task-001', taskText: 'Inspect runtime flow', suggestedRoute: 'explore' })).toEqual({
      repoId: 'repo-a',
      taskId: 'task-001',
      taskText: 'Inspect runtime flow',
      suggestedRoute: 'explore',
      policyInput: undefined
    })
  })

  it('rejects payloads missing repo or task identity', () => {
    expect(() => parseOpenCodeTaskStartPayload({ taskId: 'task-001', taskText: 'Inspect runtime flow', taskType: 'analysis' })).toThrowError(/repoId/i)
    expect(() => parseOpenCodeTaskEndPayload({ repoId: 'repo-a', taskText: 'Inspect runtime flow', taskType: 'analysis', promptSummary: 'summary', suggestedRoute: 'explore' })).toThrowError(/taskId/i)
  })
})
