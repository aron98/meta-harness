export function createPlaceholderPluginAdapter() {
  return {
    kind: 'plugin-adapter',
    packageName: '@meta-harness/plugin',
    status: 'placeholder'
  } as const;
}
