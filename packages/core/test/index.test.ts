import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME, parseHarnessMetadata } from '../src/index';

describe('parseHarnessMetadata', () => {
  it('adds the default phase when omitted', () => {
    expect(parseHarnessMetadata({ project: 'meta-harness' })).toEqual({
      phase: 'phase-0',
      project: 'meta-harness'
    });
  });

  it('exports the workspace package name', () => {
    expect(CORE_PACKAGE_NAME).toBe('@meta-harness/core');
  });
});
