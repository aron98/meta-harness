import { describe, expect, it } from 'vitest';

import plugin, { OPENCODE_HOST_ID, OPENCODE_META_HARNESS_PACKAGE_NAME, createOpenCodeAdapter } from '../src/index';

describe('OpenCode meta-harness plugin package public surface', () => {
  it('exports the workspace package name', () => {
    expect(OPENCODE_META_HARNESS_PACKAGE_NAME).toBe('@meta-harness/opencode-meta-harness');
  });

  it('exposes the real OpenCode adapter metadata', () => {
    const adapter = createOpenCodeAdapter({ dataRoot: '/tmp/meta-harness-opencode' })

    expect(OPENCODE_HOST_ID).toBe('opencode')
    expect(adapter.metadata).toEqual({
      host: 'opencode',
      kind: 'plugin-adapter',
      packageName: '@meta-harness/opencode-meta-harness',
      pluginCorePackageName: '@meta-harness/plugin-core'
    })
  });

  it('exports a default OpenCode plugin module', () => {
    expect(plugin.id).toBe('opencode-meta-harness')
    expect(plugin.server).toBeTypeOf('function')
  })
});
