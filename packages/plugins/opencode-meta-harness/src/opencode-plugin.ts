import { basename } from 'node:path'

import type { SessionPacketRoute, TaskType } from '@meta-harness/core'

import { createOpenCodeAdapter } from './create-opencode-adapter'
import {
  mapOpenCodeToolExecuteRetrievalSignal
} from './opencode-event-mappers'
import {
  parseOpenCodeToolExecuteRetrievalSignal
} from './opencode-hook-payload'

type OpenCodePluginInput = {
  project?: {
    id?: string
    name?: string
  }
  directory?: string
}

type OpenCodeChatMessageInput = {
  sessionID: string
  messageID?: string
}

type OpenCodeChatMessageOutput = {
  message?: string
  parts?: Array<Record<string, unknown>>
}

type OpenCodeHooks = {
  'chat.message'?: (input: OpenCodeChatMessageInput, output: OpenCodeChatMessageOutput) => Promise<void>
  event?: (input: OpenCodeEventInput) => Promise<void>
  'tool.execute.before'?: (input: OpenCodeToolExecuteBeforeInput, output: OpenCodeToolExecuteBeforeOutput) => Promise<void>
  'experimental.session.compacting'?: (input: OpenCodeCompactingInput, output: OpenCodeCompactingOutput) => Promise<void>
}

type OpenCodeToolExecuteBeforeInput = {
  sessionID?: string
  callID?: string
  tool?: string
}

type OpenCodeToolExecuteBeforeOutput = {
  args?: unknown
}

type OpenCodeSessionStatusPayload = {
  sessionID?: string
  status?: {
    type?: string
  }
}

type OpenCodeEventInput = {
  event: {
    type: string
    properties?: Record<string, unknown>
  }
}

type OpenCodeCompactingInput = {
  sessionID: string
}

type OpenCodeCompactingOutput = {
  context: string[]
  prompt?: string
}

export type OpenCodePluginOptions = {
  dataRoot?: string
  repoId?: string
}

type OpenCodePluginFactoryDependencies = {
  createAdapter?: typeof createOpenCodeAdapter
  now?: () => string
}

type TrackedTask = {
  repoId: string
  taskId: string
  taskText: string
  taskType: TaskType
  suggestedRoute: SessionPacketRoute
  selectedMemoryIds: string[]
  selectedArtifactIds: string[]
  verificationState: {
    status: 'pending' | 'passed' | 'failed' | 'skipped'
    checklist: string[]
    completedSteps: string[]
  }
  unresolvedQuestions: string[]
  startedAt: string
}

export type OpenCodePluginModule = {
  id: string
  server: (input: OpenCodePluginInput, options?: OpenCodePluginOptions) => Promise<OpenCodeHooks>
}

export function createOpenCodePlugin(dependencies: OpenCodePluginFactoryDependencies = {}): OpenCodePluginModule {
  const createAdapter = dependencies.createAdapter ?? createOpenCodeAdapter
  const now = dependencies.now ?? (() => new Date().toISOString())
  const activeTasks = new Map<string, TrackedTask>()

  return {
    id: 'opencode-meta-harness',
    async server(input, options = {}) {
      const dataRoot = options.dataRoot ?? input.directory ?? process.cwd()
      const repoId = options.repoId ?? deriveRepoId(input)
      const adapter = createAdapter({ dataRoot })

      return {
        'chat.message': async (messageInput, messageOutput) => {
          const taskText = extractTaskText(messageOutput)

          if (taskText.length === 0) {
            return
          }

          const referenceTime = now()
          const messageIdentity = messageInput.messageID ?? `${messageInput.sessionID}:${referenceTime}`

            try {
              const startResult = await adapter.startTask({
                packetId: messageInput.messageID ?? `${messageIdentity}:packet`,
                repoId,
                taskId: messageInput.messageID ?? `${messageIdentity}:chat-message`,
              taskText,
              taskType: 'analysis',
              prompt: taskText,
              memoryRecords: [],
                artifactRecords: [],
                referenceTime
              })

              activeTasks.set(messageInput.sessionID, {
                repoId,
                taskId: startResult.result.context.taskId ?? (messageInput.messageID ?? `${messageIdentity}:chat-message`),
                taskText,
                taskType: startResult.result.context.packet.taskType,
                suggestedRoute: startResult.result.context.packet.suggestedRoute,
                selectedMemoryIds: [...startResult.result.context.packet.selectedMemoryIds],
                selectedArtifactIds: [...startResult.result.context.packet.selectedArtifactIds],
                verificationState: {
                  status: startResult.result.taskStart.verificationState.status,
                  checklist: [...startResult.result.taskStart.verificationState.checklist],
                  completedSteps: [...startResult.result.taskStart.verificationState.completedSteps]
                },
                unresolvedQuestions: [...startResult.result.taskStart.unresolvedQuestions],
                startedAt: startResult.result.taskStart.startedAt
              })
            } catch {
              return
            }
        },
        event: async ({ event }) => {
          const statusPayload = asSessionStatusPayload(event.properties)
          const sessionID = statusPayload.sessionID
          if (!sessionID) {
            return
          }

          const tracked = activeTasks.get(sessionID)
          if (!tracked) {
            return
          }

          const isIdleTransition = event.type === 'session.status' && statusPayload.status?.type === 'idle'
          const isIdleFallback = event.type === 'session.idle'
          if (!isIdleTransition && !isIdleFallback) {
            return
          }

          try {
            await adapter.endTask({
              id: `${tracked.taskId}:end`,
              repoId: tracked.repoId,
              taskId: tracked.taskId,
              taskText: tracked.taskText,
              taskType: tracked.taskType,
              promptSummary: tracked.taskText,
              selectedMemoryIds: tracked.selectedMemoryIds,
              selectedArtifactIds: tracked.selectedArtifactIds,
              suggestedRoute: tracked.suggestedRoute,
              verificationState: tracked.verificationState,
              unresolvedQuestions: tracked.unresolvedQuestions,
              filesInspected: [],
              filesChanged: [],
              commands: [],
              diagnostics: ['Derived from OpenCode session idle signal.'],
              outcome: 'partial',
              tags: ['opencode', 'host-integration', event.type],
              startedAt: tracked.startedAt,
              endedAt: now()
            })
          } catch {
            return
          } finally {
            activeTasks.delete(sessionID)
          }
        },
        'tool.execute.before': async (toolInput, toolOutput) => {
          const signal = parseOpenCodeToolExecuteRetrievalSignal(toolInput, toolOutput)
          if (!signal) {
            return
          }

          const tracked = activeTasks.get(signal.sessionID)
          if (!tracked) {
            return
          }

          try {
            await adapter.inspectRetrieval(
              mapOpenCodeToolExecuteRetrievalSignal(signal, {
                repoId: tracked.repoId,
                taskId: tracked.taskId,
                taskText: tracked.taskText,
                taskType: tracked.taskType,
                policyInput: undefined
              })
            )
          } catch {
            return
          }
        },
        'experimental.session.compacting': async (compactingInput, compactingOutput) => {
          const tracked = activeTasks.get(compactingInput.sessionID)
          if (!tracked) {
            return
          }

          const compactedAt = now()
          const promptOverride = typeof compactingOutput.prompt === 'string' && compactingOutput.prompt.trim().length > 0
            ? compactingOutput.prompt.trim()
            : undefined

          try {
            await adapter.compactSession({
              repoId: tracked.repoId,
              taskId: tracked.taskId,
              taskText: promptOverride ?? tracked.taskText,
              selectedMemoryIds: tracked.selectedMemoryIds,
              selectedArtifactIds: tracked.selectedArtifactIds,
              suggestedRoute: tracked.suggestedRoute,
              verificationState: tracked.verificationState,
              unresolvedQuestions: tracked.unresolvedQuestions,
              startedAt: tracked.startedAt,
              endedAt: compactedAt,
              compactedAt
            })
          } catch {
            return
          }
        }
      }
    }
  }
}

function asSessionStatusPayload(value: Record<string, unknown> | undefined): OpenCodeSessionStatusPayload {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as OpenCodeSessionStatusPayload
}

function deriveRepoId(input: OpenCodePluginInput): string {
  if (typeof input.project?.id === 'string' && input.project.id.trim().length > 0) {
    return input.project.id
  }

  if (typeof input.project?.name === 'string' && input.project.name.trim().length > 0) {
    return input.project.name
  }

  if (typeof input.directory === 'string' && input.directory.trim().length > 0) {
    return basename(input.directory)
  }

  return 'opencode-project'
}

function extractTaskText(output: OpenCodeChatMessageOutput): string {
  if (typeof output.message === 'string' && output.message.trim().length > 0) {
    return output.message.trim()
  }

  const partText = (output.parts ?? [])
    .map((part) => {
      const text = part.text
      if (typeof text === 'string') {
        return text
      }

      const content = part.content
      return typeof content === 'string' ? content : ''
    })
    .filter((value) => value.trim().length > 0)
    .join('\n')

  return partText.trim()
}

const opencodePlugin = createOpenCodePlugin()

export default opencodePlugin
