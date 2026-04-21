import { describe, expect, it } from 'vitest';

import { createPlaceholderPluginAdapter } from '../src/index';

describe('createPlaceholderPluginAdapter', () => {
  it('returns a placeholder adapter descriptor', () => {
    expect(createPlaceholderPluginAdapter()).toEqual({
      kind: 'plugin-adapter',
      packageName: '@meta-harness/plugin',
      status: 'placeholder'
    });
  });
});
