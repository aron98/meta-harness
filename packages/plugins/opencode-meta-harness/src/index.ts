export const OPENCODE_META_HARNESS_PACKAGE_NAME = '@meta-harness/opencode-meta-harness';
export const OPENCODE_HOST_ID = 'opencode';
export const OPENCODE_PLUGIN_CORE_PACKAGE_NAME = '@meta-harness/plugin-core';

export function createOpenCodePluginPlaceholder() {
  return {
    host: OPENCODE_HOST_ID,
    kind: 'plugin-adapter',
    packageName: OPENCODE_META_HARNESS_PACKAGE_NAME,
    pluginCorePackageName: OPENCODE_PLUGIN_CORE_PACKAGE_NAME,
    status: 'bootstrap-placeholder'
  } as const;
}

export * from './create-opencode-adapter'
export * from './opencode-observability'
export * from './opencode-hook-payload'
export * from './opencode-event-mappers'
