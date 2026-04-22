export const PLUGIN_CORE_PACKAGE_NAME = '@meta-harness/plugin-core'

export function createPluginCorePlaceholder() {
  return {
    kind: 'plugin-core',
    packageName: PLUGIN_CORE_PACKAGE_NAME,
    status: 'bootstrap-placeholder'
  } as const
}

export * from './adapter/adapter-policy-input'
export * from './adapter/adapter-observability'
export * from './adapter/adapter-storage'
export * from './adapter/compact-host-session'
export * from './adapter/create-host-artifact'
export * from './adapter/create-host-session'
export * from './adapter/host-adapter-contract'
export * from './adapter/inspect-host-retrieval'
