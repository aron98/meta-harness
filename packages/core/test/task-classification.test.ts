import { describe, expect, it } from 'vitest';

import { classifyTaskType } from '../src/index';

describe('classifyTaskType', () => {
  it('treats build creation prompts as codegen instead of verification', () => {
    expect(classifyTaskType('Build a retry helper for flaky network calls.')).toBe('codegen');
  });

  it('keeps build validation prompts in verification', () => {
    expect(classifyTaskType('Build and test the package to verify the release flow.')).toBe('verification');
  });
});
