import { describe, expect, it } from 'vitest'

import {
  parseOpenCodeCompactionPayload,
  parseOpenCodeInspectRetrievalPayload,
  parseOpenCodeToolExecuteRetrievalSignal,
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

  it('classifies documented retrieval-like tool.execute payloads heuristically by allowlisted tool name while preserving observed args', () => {
    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-read',
      tool: 'read',
      ignored: true
    }, {
      args: { filePath: '/repo/src/index.ts', offset: 1, limit: 50 }
    })).toEqual({
      sessionID: 'session-001',
      callID: 'call-read',
      toolName: 'read',
      arguments: { filePath: '/repo/src/index.ts', offset: 1, limit: 50 }
    })

    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-grep',
      tool: 'grep'
    }, {
      args: { pattern: 'inspectRetrieval', include: '*.ts' }
    })).toEqual({
      sessionID: 'session-001',
      callID: 'call-grep',
      toolName: 'grep',
      arguments: { pattern: 'inspectRetrieval', include: '*.ts' }
    })

    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-glob',
      tool: 'glob'
    }, {
      args: { pattern: 'src/**/*.ts' }
    })).toEqual({
      sessionID: 'session-001',
      callID: 'call-glob',
      toolName: 'glob',
      arguments: { pattern: 'src/**/*.ts' }
    })

    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-webfetch',
      tool: 'webfetch'
    }, {
      args: { url: 'https://example.com/docs', format: 'markdown' }
    })).toEqual({
      sessionID: 'session-001',
      callID: 'call-webfetch',
      toolName: 'webfetch',
      arguments: { url: 'https://example.com/docs', format: 'markdown' }
    })
  })

  it('ignores unrelated or unsupported tool.execute payloads', () => {
    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-bash',
      tool: 'bash'
    }, {
      args: { command: 'pnpm test' }
    })).toBeUndefined()

    expect(parseOpenCodeToolExecuteRetrievalSignal({
      sessionID: 'session-001',
      callID: 'call-websearch',
      tool: 'websearch'
    }, {
      args: { query: 'meta harness' }
    })).toBeUndefined()
  })
})
