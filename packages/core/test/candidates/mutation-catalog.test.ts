import { describe, expect, it } from 'vitest';

import {
  enumerateCandidateMutations,
  parseCandidate,
  parseCandidateMutation,
  type CandidateMutation
} from '../../src/index';
import { baselineCandidate } from './candidate.test';

describe('candidate mutation catalog', () => {
  it('enumerates deterministic mutation records', () => {
    const firstRun = enumerateCandidateMutations();
    const secondRun = enumerateCandidateMutations();

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.length).toBeGreaterThan(0);
    expect(firstRun.map((mutation) => mutation.id)).toEqual([...new Set(firstRun.map((mutation) => mutation.id))]);
    expect(firstRun).toContainEqual({
      id: 'retrieval-repo-match-weight-high',
      label: 'Increase repository match retrieval weight',
      section: 'retrieval',
      field: 'repoMatchWeight',
      value: 4
    });
  });

  it('rejects catalog entries outside allowed ranges', () => {
    const invalidMutation: CandidateMutation = {
      id: 'invalid-weight',
      label: 'Invalid retrieval weight',
      section: 'retrieval',
      field: 'repoMatchWeight',
      value: 99
    };

    expect(() => parseCandidateMutation(invalidMutation)).toThrow();
  });

  it('applies every catalog mutation to a parseable candidate policy', () => {
    for (const mutation of enumerateCandidateMutations()) {
      const candidate = {
        ...baselineCandidate,
        id: mutation.id,
        label: mutation.label,
        mutationIds: [mutation.id],
        policy: {
          ...baselineCandidate.policy,
          [mutation.section]: {
            ...baselineCandidate.policy[mutation.section],
            [mutation.field]: mutation.value
          }
        }
      };

      expect(parseCandidate(candidate).id).toBe(mutation.id);
    }
  });
});
