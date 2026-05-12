import { describe, expect, it } from 'vitest';

import {
  parseAdapterPolicyInput,
  parseAdapterRuntimePolicyArtifact,
  projectAdapterRuntimePolicyArtifact
} from '../../src/index';

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

describe('AdapterRuntimePolicyArtifact', () => {
  const exportedArtifact = {
    runId: 'docs-candidate-optimization',
    candidateId: 'candidate-a',
    policy: {
      retrieval: {
        repoMatchWeight: 3,
        recentHalfLifeDays: 21,
        taskLocalMemoryBonus: 0.75
      },
      routing: {
        taskTypeOrder: ['analysis', 'verification'],
        buildPromptMode: 'prefer-verification'
      },
      verification: {
        includeArtifactVerificationCommands: true,
        includeMemoryCommandHints: true,
        requirePromptClarificationOnUnclear: false
      },
      context: {
        maxMemories: 4,
        maxArtifacts: 2
      }
    }
  };

  it('parses exported candidate policy artifacts with identity and policy sections', () => {
    expect(parseAdapterRuntimePolicyArtifact(exportedArtifact)).toEqual(exportedArtifact);
  });

  it('projects runtime policy artifacts into adapter inputs and context limits', () => {
    expect(projectAdapterRuntimePolicyArtifact(exportedArtifact)).toEqual({
      policyInput: {
        retrieval: exportedArtifact.policy.retrieval,
        routing: exportedArtifact.policy.routing,
        verification: exportedArtifact.policy.verification
      },
      maxMemories: 4,
      maxArtifacts: 2,
      identity: {
        runId: 'docs-candidate-optimization',
        candidateId: 'candidate-a'
      }
    });
  });

  it('rejects missing required artifact fields', () => {
    const malformedArtifacts: unknown[] = [
      {
        candidateId: 'candidate-a',
        policy: exportedArtifact.policy
      },
      {
        runId: 'docs-candidate-optimization',
        policy: exportedArtifact.policy
      },
      {
        runId: 'docs-candidate-optimization',
        candidateId: 'candidate-a'
      }
    ];

    for (const malformedArtifact of malformedArtifacts) {
      expect(() => parseAdapterRuntimePolicyArtifact(malformedArtifact)).toThrowError();
    }
  });

  it('rejects unknown top-level artifact fields', () => {
    expect(() =>
      parseAdapterRuntimePolicyArtifact({
        ...exportedArtifact,
        source: 'candidate-workflow'
      })
    ).toThrowError();
  });

  it('rejects exported runtime artifacts with empty policies', () => {
    expect(parseAdapterPolicyInput({})).toEqual({});

    expect(() =>
      parseAdapterRuntimePolicyArtifact({
        runId: 'docs-candidate-optimization',
        candidateId: 'candidate-a',
        policy: {}
      })
    ).toThrowError();
  });

  it('rejects malformed context limits', () => {
    const malformedContexts: unknown[] = [
      { maxMemories: '4', maxArtifacts: 2 },
      { maxMemories: -1, maxArtifacts: 2 },
      { maxMemories: 1.5, maxArtifacts: 2 },
      { maxMemories: 4, maxArtifacts: '2' },
      { maxMemories: 4, maxArtifacts: -1 },
      { maxMemories: 4, maxArtifacts: 2.5 },
      { maxMemories: 4, maxArtifacts: 2, extraLimit: 1 }
    ];

    for (const context of malformedContexts) {
      expect(() =>
        parseAdapterRuntimePolicyArtifact({
          ...exportedArtifact,
          policy: {
            ...exportedArtifact.policy,
            context
          }
        })
      ).toThrowError();
    }
  });
});
