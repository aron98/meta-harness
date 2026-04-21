import { describe, expect, it } from 'vitest';

import { renderHelp } from '../src/index';

describe('renderHelp', () => {
  it('describes the scaffolded commands', () => {
    expect(renderHelp()).toContain('@meta-harness/core');
    expect(renderHelp()).toContain('pnpm test');
  });
});
