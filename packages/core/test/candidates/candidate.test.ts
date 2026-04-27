import { describe, expect, it } from 'vitest';

import { parseCandidate, type Candidate } from '../../src/index';

export const baselineCandidate: Candidate = {
  id: 'baseline',
  label: 'Baseline policy',
  createdAt: '2026-04-26T00:00:00.000Z',
  mutationIds: [],
  policy: {
    retrieval: {
      repoMatchWeight: 3,
      tagOverlapWeight: 2,
      recentMaxBonus: 2,
      recentHalfLifeDays: 14,
      taskTypeWeight: 2,
      outcomeWeight: 1,
      taskLocalMemoryBonus: 3
    },
    routing: {
      taskTypeOrder: ['fix', 'codegen', 'verification', 'documentation', 'planning', 'analysis'],
      buildPromptMode: 'default'
    },
    verification: {
      includeArtifactVerificationCommands: true,
      includeMemoryCommandHints: true,
      requirePromptClarificationOnUnclear: true
    }
  }
};

describe('candidate schema', () => {
  it('parses a baseline candidate', () => {
    expect(parseCandidate(baselineCandidate)).toEqual(baselineCandidate);
  });

  it('rejects unknown policy sections', () => {
    expect(() =>
      parseCandidate({
        ...baselineCandidate,
        policy: {
          ...baselineCandidate.policy,
          prompt: { freeformInstruction: 'prefer shorter prompts' }
        }
      })
    ).toThrow();
  });

  it('rejects mutation values outside explicit ranges', () => {
    expect(() =>
      parseCandidate({
        ...baselineCandidate,
        policy: {
          ...baselineCandidate.policy,
          retrieval: {
            ...baselineCandidate.policy.retrieval,
            repoMatchWeight: 100
          }
        }
      })
    ).toThrow();

    expect(() =>
      parseCandidate({
        ...baselineCandidate,
        policy: {
          ...baselineCandidate.policy,
          routing: {
            ...baselineCandidate.policy.routing,
            buildPromptMode: 'rewrite-source'
          }
        }
      })
    ).toThrow();
  });
});
