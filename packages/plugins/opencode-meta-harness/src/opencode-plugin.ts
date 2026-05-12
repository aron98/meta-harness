import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, resolve } from 'node:path'

import type { SessionPacketRoute, TaskType } from '@meta-harness/core'
import {
  parseAdapterRuntimePolicyArtifact,
  projectAdapterRuntimePolicyArtifact,
  type AdapterPolicyIdentity,
  type AdapterPolicyInput,
  type AdapterRuntimeRoots,
  type ProjectedRuntimePolicy
} from '@meta-harness/plugin-core'

import { createOpenCodeAdapter } from './create-opencode-adapter'
import { resolveDataRoot } from './install'
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
  policyArtifactFile?: string
  repoId?: string
  userDataRoot?: string
  userPolicyArtifactFile?: string
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
  policyInput?: AdapterPolicyInput
  policyIdentity?: AdapterPolicyIdentity
  maxMemories?: number
  maxArtifacts?: number
}

type ResolvedRuntimeOptions = {
  userDataRoot: string
  projectDataRoot?: string
  userPolicyArtifactFile?: string
  projectPolicyArtifactFile?: string
}

type ActiveRuntimePolicy = ProjectedRuntimePolicy & {
  identity: AdapterPolicyIdentity
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
      const resolvedOptions = resolveRuntimeOptions(input, options)
      const repoId = options.repoId ?? deriveRepoId(input)
      const runtimeRoots = buildRuntimeRoots(resolvedOptions)
      const activePolicy = await loadActiveRuntimePolicy(resolvedOptions)
      const adapter = createAdapter({ dataRoot: resolvedOptions.userDataRoot, runtimeRoots })

      return {
        'chat.message': async (messageInput, messageOutput) => {
          const taskText = extractTaskText(messageOutput)

          if (taskText.length === 0) {
            return
          }

          const referenceTime = now()
          const messageIdentity = messageInput.messageID ?? `${messageInput.sessionID}:${referenceTime}`

            try {
              const baseStartInput = {
                packetId: messageInput.messageID ?? `${messageIdentity}:packet`,
                repoId,
                taskId: messageInput.messageID ?? `${messageIdentity}:chat-message`,
                taskText,
                taskType: 'analysis',
                prompt: taskText,
                referenceTime
              }
              const startInput = activePolicy === undefined && runtimeRoots.projectDataRoot === undefined ? {
                ...baseStartInput,
                memoryRecords: [],
                artifactRecords: []
              } : {
                ...baseStartInput,
                runtimeRoots,
                userMemoryRecords: [],
                projectMemoryRecords: [],
                userArtifactRecords: [],
                projectArtifactRecords: [],
                policyInput: activePolicy?.policyInput,
                maxMemories: activePolicy?.maxMemories,
                maxArtifacts: activePolicy?.maxArtifacts,
                policyIdentity: activePolicy?.identity
              }
              const startResult = await adapter.startTask(startInput)

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
                startedAt: startResult.result.taskStart.startedAt,
                policyInput: activePolicy?.policyInput,
                policyIdentity: activePolicy?.identity,
                maxMemories: activePolicy?.maxMemories,
                maxArtifacts: activePolicy?.maxArtifacts
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
            const baseEndInput = {
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
              outcome: 'partial' as const,
              tags: ['opencode', 'host-integration', event.type],
              startedAt: tracked.startedAt,
              endedAt: now()
            }
            const endInput = tracked.policyInput === undefined && tracked.policyIdentity === undefined ? baseEndInput : {
              ...baseEndInput,
              policyInput: tracked.policyInput,
              policyIdentity: tracked.policyIdentity
            }

            await adapter.endTask(endInput)
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
            const inspectRetrievalInput = mapOpenCodeToolExecuteRetrievalSignal(signal, {
                repoId: tracked.repoId,
                taskId: tracked.taskId,
                taskText: tracked.taskText,
                taskType: tracked.taskType,
                policyInput: tracked.policyInput,
                maxMemories: tracked.maxMemories,
                maxArtifacts: tracked.maxArtifacts
              })

            await adapter.inspectRetrieval(tracked.policyIdentity === undefined ? inspectRetrievalInput : {
              ...inspectRetrievalInput,
              policyIdentity: tracked.policyIdentity
            })
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
            const baseCompactionInput = {
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
            }
            const compactionInput = tracked.policyInput === undefined && tracked.policyIdentity === undefined ? baseCompactionInput : {
              ...baseCompactionInput,
              policyInput: tracked.policyInput,
              policyIdentity: tracked.policyIdentity
            }

            await adapter.compactSession(compactionInput)
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

function resolveRuntimeOptions(input: OpenCodePluginInput, options: OpenCodePluginOptions): ResolvedRuntimeOptions {
  const baseDirectory = getBaseDirectory(input)
  const userDataRoot = options.userDataRoot === undefined
    ? resolveDefaultUserDataRoot()
    : resolveRuntimePath(options.userDataRoot, baseDirectory, true)
  const projectDataRoot = options.dataRoot === undefined
    ? undefined
    : resolveRuntimePath(options.dataRoot, baseDirectory, false)
  const userPolicyArtifactFile = options.userPolicyArtifactFile === undefined
    ? undefined
    : resolveRuntimePath(options.userPolicyArtifactFile, baseDirectory, true)
  const projectPolicyArtifactFile = options.policyArtifactFile === undefined
    ? undefined
    : resolveRuntimePath(options.policyArtifactFile, baseDirectory, false)

  return {
    userDataRoot,
    projectDataRoot,
    userPolicyArtifactFile,
    projectPolicyArtifactFile
  }
}

function resolveDefaultUserDataRoot(): string {
  return resolveDataRoot({ home: process.env.HOME ?? homedir(), env: process.env })
}

function getBaseDirectory(input: OpenCodePluginInput): string {
  return input.directory ?? process.cwd()
}

function resolveRuntimePath(pathValue: string, baseDirectory: string, expandHome: boolean): string {
  const expandedPath = expandHome ? expandHomeDirectory(pathValue) : pathValue

  return isAbsolute(expandedPath) ? expandedPath : resolve(baseDirectory, expandedPath)
}

function expandHomeDirectory(pathValue: string): string {
  if (pathValue === '~') {
    return homedir()
  }

  if (pathValue.startsWith('~/')) {
    return resolve(homedir(), pathValue.slice(2))
  }

  return pathValue
}

function buildRuntimeRoots(options: ResolvedRuntimeOptions): AdapterRuntimeRoots {
  if (options.projectDataRoot === undefined) {
    return { userDataRoot: options.userDataRoot }
  }

  return {
    userDataRoot: options.userDataRoot,
    projectDataRoot: options.projectDataRoot
  }
}

async function loadActiveRuntimePolicy(options: ResolvedRuntimeOptions): Promise<ActiveRuntimePolicy | undefined> {
  const projectPolicy = options.projectPolicyArtifactFile === undefined
    ? undefined
    : await loadRuntimePolicyArtifact('policyArtifactFile', options.projectPolicyArtifactFile, 'project')
  if (projectPolicy !== undefined) {
    return projectPolicy
  }

  const userPolicy = options.userPolicyArtifactFile === undefined
    ? undefined
    : await loadRuntimePolicyArtifact('userPolicyArtifactFile', options.userPolicyArtifactFile, 'user')

  return userPolicy
}

async function loadRuntimePolicyArtifact(
  optionName: 'userPolicyArtifactFile' | 'policyArtifactFile',
  artifactFile: string,
  sourceScope: AdapterPolicyIdentity['sourceScope']
): Promise<ActiveRuntimePolicy> {
  try {
    const artifactContent = await readFile(artifactFile, 'utf8')
    const artifactJson: unknown = JSON.parse(artifactContent)
    const artifact = parseAdapterRuntimePolicyArtifact(artifactJson)
    const projected = projectAdapterRuntimePolicyArtifact(artifact)

    return {
      ...projected,
      identity: {
        runId: projected.identity.runId,
        candidateId: projected.identity.candidateId,
        sourceScope,
        artifactFile
      }
    }
  } catch (error) {
    throw new Error(`Failed to load ${optionName} ${artifactFile}: ${formatErrorMessage(error)}`)
  }
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const opencodePlugin = createOpenCodePlugin()

export default opencodePlugin
