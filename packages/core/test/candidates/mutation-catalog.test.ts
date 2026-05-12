import { describe, expect, it } from 'vitest';

import {
  enumerateCandidateMutations,
  generateCandidateSearchCandidates,
  parseCandidate,
  parseCandidateMutation,
  parseCandidateSearchConfig,
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
      value: 12
    });
  });

  it('generates default retrieval mutations that change the generated baseline in the advertised direction', () => {
    const candidates = generateCandidateSearchCandidates({ referenceTime: '2026-04-26T00:00:00.000Z' });
    const baseline = candidates.find((candidate) => candidate.id === 'baseline');
    const repoWeight = candidates.find((candidate) => candidate.id === 'retrieval-repo-match-weight-high');
    const tagOverlap = candidates.find((candidate) => candidate.id === 'retrieval-tag-overlap-weight-high');
    const recency = candidates.find((candidate) => candidate.id === 'retrieval-recency-half-life-short');
    const taskLocal = candidates.find((candidate) => candidate.id === 'retrieval-task-local-memory-high');

    expect(baseline).toBeDefined();
    expect(repoWeight?.label).toContain('Increase');
    expect(repoWeight?.policy.retrieval.repoMatchWeight).toBeGreaterThan(baseline?.policy.retrieval.repoMatchWeight ?? 0);
    expect(tagOverlap?.label).toContain('Increase');
    expect(tagOverlap?.policy.retrieval.tagOverlapWeight).toBeGreaterThan(baseline?.policy.retrieval.tagOverlapWeight ?? 0);
    expect(recency?.label).toContain('Prefer more recent');
    expect(recency?.policy.retrieval.recentHalfLifeDays).toBeLessThan(baseline?.policy.retrieval.recentHalfLifeDays ?? 0);
    expect(taskLocal?.label).toContain('Increase');
    expect(taskLocal?.policy.retrieval.taskLocalMemoryBonus).toBeGreaterThan(baseline?.policy.retrieval.taskLocalMemoryBonus ?? 0);
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

  it('parses custom mutation search config with default inclusion disabled', () => {
    const config = parseCandidateSearchConfig({
      mutations: [
        {
          id: 'custom-repo-weight',
          label: 'Custom repo weight',
          section: 'retrieval',
          field: 'repoMatchWeight',
          value: 5
        }
      ],
      maxCombinationSize: 2,
      maxCandidates: 3
    });

    expect(config.includeDefaultMutations).toBe(false);
    expect(config.mutations.map((mutation) => mutation.id)).toEqual(['custom-repo-weight']);
  });

  it('generates bounded deterministic candidate combinations', () => {
    const mutations: CandidateMutation[] = [
      {
        id: 'custom-a',
        label: 'Custom A',
        section: 'retrieval',
        field: 'repoMatchWeight',
        value: 5
      },
      {
        id: 'custom-b',
        label: 'Custom B',
        section: 'retrieval',
        field: 'tagOverlapWeight',
        value: 4
      },
      {
        id: 'custom-c',
        label: 'Custom C',
        section: 'verification',
        field: 'includeMemoryCommandHints',
        value: false
      }
    ];

    const candidates = generateCandidateSearchCandidates({
      referenceTime: '2026-04-26T00:00:00.000Z',
      searchConfig: { mutations, maxCombinationSize: 2, maxCandidates: 7 }
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'baseline',
      'custom-a',
      'custom-b',
      'custom-c',
      'candidate-custom-a__custom-b',
      'candidate-custom-a__custom-c',
      'candidate-custom-b__custom-c'
    ]);
    expect(candidates[4]).toMatchObject({
      id: 'candidate-custom-a__custom-b',
      label: 'Custom A + Custom B',
      baseCandidateId: 'baseline',
      mutationIds: ['custom-a', 'custom-b']
    });
    expect(candidates[4]?.policy.retrieval.repoMatchWeight).toBe(5);
    expect(candidates[4]?.policy.retrieval.tagOverlapWeight).toBe(4);
  });

  it('rejects generated search spaces above the configured candidate cap', () => {
    const mutations: CandidateMutation[] = [
      {
        id: 'custom-a',
        label: 'Custom A',
        section: 'retrieval',
        field: 'repoMatchWeight',
        value: 5
      },
      {
        id: 'custom-b',
        label: 'Custom B',
        section: 'verification',
        field: 'includeMemoryCommandHints',
        value: false
      }
    ];

    expect(() =>
      generateCandidateSearchCandidates({
        referenceTime: '2026-04-26T00:00:00.000Z',
        searchConfig: { mutations, maxCombinationSize: 2, maxCandidates: 3 }
      })
    ).toThrow('candidate search generated 4 candidates, which exceeds maxCandidates 3');
  });
});
