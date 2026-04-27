import { describe, expect, it } from 'vitest';

import { evaluateCandidate } from '../../src/index';
import { baselineCandidate } from './candidate.test';

describe('evaluateCandidate', () => {
  it('evaluates one candidate and records per-fixture packet traces', () => {
    const result = evaluateCandidate({
      candidate: baselineCandidate,
      split: 'search',
      fixtures: [
        {
          id: 'implement-retry',
          title: 'Implement retry helper',
          prompt: 'Implement a retry helper for flaky network calls.',
          route: 'implement',
          split: 'train',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run the smallest relevant verification command after implementation'],
          tags: ['implement', 'retry']
        }
      ],
      memoryRecords: [],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z'
    });

    expect(result.summary).toMatchObject({ candidateId: 'baseline', split: 'search', fixtureCount: 1 });
    expect(result.fixtures[0]?.fixtureId).toBe('implement-retry');
    expect(result.fixtures[0]?.packet.id).toBe('baseline-implement-retry-search');
    expect(result.fixtures[0]?.metrics.routeHitRate).toBe(1);
  });

  it('applies memory limits after ranking rather than store order', () => {
    const result = evaluateCandidate({
      candidate: baselineCandidate,
      split: 'search',
      fixtures: [
        {
          id: 'implement-retry',
          title: 'Implement retry helper',
          prompt: 'Implement a retry helper for flaky network calls.',
          route: 'implement',
          split: 'train',
          repo: { id: 'repo-a', maturity: 'active' },
          routeHints: ['implement'],
          checklistHints: ['Run pnpm test'],
          tags: ['retry']
        }
      ],
      memoryRecords: [
        {
          id: 'memory-unrelated-first',
          scope: 'repo-local',
          repoId: 'repo-z',
          kind: 'summary',
          value: 'Unrelated note that should not beat the retry memory.',
          source: 'human-input',
          sourceArtifactIds: [],
          confidence: 'medium',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z'
        },
        {
          id: 'memory-retry-second',
          scope: 'repo-local',
          repoId: 'repo-a',
          kind: 'summary',
          value: 'Retry implementations should run pnpm test.',
          source: 'human-input',
          sourceArtifactIds: [],
          confidence: 'high',
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z'
        }
      ],
      artifactRecords: [],
      referenceTime: '2026-04-26T00:00:00.000Z',
      maxMemories: 1
    });

    expect(result.fixtures[0]?.packet.selectedMemoryIds).toEqual(['memory-retry-second']);
  });
});
