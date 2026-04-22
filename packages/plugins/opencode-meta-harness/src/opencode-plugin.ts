import { basename } from 'node:path'

import { createOpenCodeAdapter } from './create-opencode-adapter'

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
  chat?: {
    message?: (input: OpenCodeChatMessageInput, output: OpenCodeChatMessageOutput) => Promise<void>
  }
}

export type OpenCodePluginOptions = {
  dataRoot?: string
  repoId?: string
}

type OpenCodePluginFactoryDependencies = {
  createAdapter?: typeof createOpenCodeAdapter
  now?: () => string
}

export type OpenCodePluginModule = {
  id: string
  server: (input: OpenCodePluginInput, options?: OpenCodePluginOptions) => Promise<OpenCodeHooks>
}

export function createOpenCodePlugin(dependencies: OpenCodePluginFactoryDependencies = {}): OpenCodePluginModule {
  const createAdapter = dependencies.createAdapter ?? createOpenCodeAdapter
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    id: 'opencode-meta-harness',
    async server(input, options = {}) {
      const dataRoot = options.dataRoot ?? input.directory ?? process.cwd()
      const repoId = options.repoId ?? deriveRepoId(input)
      const adapter = createAdapter({ dataRoot })

      return {
        chat: {
          async message(messageInput, messageOutput) {
            const taskText = extractTaskText(messageOutput)

            if (taskText.length === 0) {
              return
            }

            const referenceTime = now()
            const messageIdentity = messageInput.messageID ?? `${messageInput.sessionID}:${referenceTime}`

            try {
              await adapter.startTask({
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
            } catch {
              return
            }
          }
        }
      }
    }
  }
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
