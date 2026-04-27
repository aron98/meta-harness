import { describe, expect, it } from 'vitest';

import { classifyTaskType } from '../src/index';

describe('classifyTaskType', () => {
  it('treats build creation prompts as codegen instead of verification', () => {
    expect(classifyTaskType('Build a retry helper for flaky network calls.')).toBe('codegen');
  });

  it('keeps build validation prompts in verification', () => {
    expect(classifyTaskType('Build and test the package to verify the release flow.')).toBe('verification');
  });

  it('uses candidate routing order for ambiguous prompts', () => {
    expect(classifyTaskType('Fix and verify the broken release build.')).toBe('verification');
    expect(classifyTaskType('Fix and verify the broken release build.', { taskTypeOrder: ['fix', 'verification'] })).toBe('fix');
  });

  it('uses candidate build prompt mode preferences', () => {
    expect(classifyTaskType('Build and test the package.', { buildPromptMode: 'prefer-codegen' })).toBe('codegen');
    expect(classifyTaskType('Build a retry helper.', { buildPromptMode: 'prefer-verification' })).toBe('verification');
  });
});
