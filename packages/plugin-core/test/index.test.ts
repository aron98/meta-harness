import { describe, expect, it } from 'vitest';

import { PLUGIN_CORE_PACKAGE_NAME, createPluginCorePlaceholder } from '../src/index';

describe('plugin-core package public surface', () => {
  it('exports the workspace package name', () => {
    expect(PLUGIN_CORE_PACKAGE_NAME).toBe('@meta-harness/plugin-core');
  });

  it('exposes a bootstrap placeholder descriptor for future host adapters', () => {
    expect(createPluginCorePlaceholder()).toEqual({
      kind: 'plugin-core',
      packageName: '@meta-harness/plugin-core',
      status: 'bootstrap-placeholder'
    });
  });
});
