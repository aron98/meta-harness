import { describe, expect, it } from 'vitest';

import { parseAdapterPolicyInput } from '../../src/index';

describe('AdapterPolicyInput', () => {
  it('parses valid retrieval, routing, and verification sections', () => {
    expect(
      parseAdapterPolicyInput({
        retrieval: {
          repoMatchWeight: 2,
          recentHalfLifeDays: 14,
          taskLocalMemoryBonus: 0.5
        },
        routing: {
          taskTypeOrder: ['analysis', 'verification'],
          buildPromptMode: 'prefer-verification'
        },
        verification: {
          includeArtifactVerificationCommands: true,
          includeMemoryCommandHints: false,
          requirePromptClarificationOnUnclear: true
        }
      })
    ).toEqual({
      retrieval: {
        repoMatchWeight: 2,
        recentHalfLifeDays: 14,
        taskLocalMemoryBonus: 0.5
      },
      routing: {
        taskTypeOrder: ['analysis', 'verification'],
        buildPromptMode: 'prefer-verification'
      },
      verification: {
        includeArtifactVerificationCommands: true,
        includeMemoryCommandHints: false,
        requirePromptClarificationOnUnclear: true
      }
    });
  });

  it('rejects unknown top-level sections', () => {
    expect(() =>
      parseAdapterPolicyInput({
        retrieval: {
          repoMatchWeight: 1
        },
        unsupported: {
          enabled: true
        }
      })
    ).toThrowError(/unrecognized key/i);
  });
});
