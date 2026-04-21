import type { SessionPacketRoute } from '@meta-harness/core';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function freezeDeep<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== 'object') {
    return value as DeepReadonly<T>;
  }

  const nestedValues = Array.isArray(value) ? value : Object.values(value);

  for (const nestedValue of nestedValues) {
    freezeDeep(nestedValue);
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

export type BenchmarkFixture = {
  id: string;
  title: string;
  prompt: string;
  route: SessionPacketRoute;
  split: 'train' | 'held-out';
  repo: {
    id: string;
    maturity: 'new' | 'active' | 'legacy';
  };
  routeHints: SessionPacketRoute[];
  checklistHints: string[];
  tags: string[];
};

export type BenchmarkCatalog = readonly DeepReadonly<BenchmarkFixture>[];

export const benchmarkFixtures: BenchmarkCatalog = freezeDeep([
  {
    id: 'explore-monorepo-layout',
    title: 'Explore a fresh monorepo layout',
    prompt: 'Explore the repository and identify package boundaries and entry points.',
    route: 'explore',
    split: 'train',
    repo: { id: 'repo-alpha', maturity: 'new' },
    routeHints: ['explore'],
    checklistHints: ['Inspect root package metadata', 'List package entry points'],
    tags: ['explore', 'repo', 'monorepo']
  },
  {
    id: 'verify-release-build',
    title: 'Verify a release build path',
    prompt: 'Verify the release build and report whether it passes with evidence.',
    route: 'verify',
    split: 'train',
    repo: { id: 'repo-alpha', maturity: 'active' },
    routeHints: ['verify'],
    checklistHints: ['Run the build command', 'Capture pass or fail output'],
    tags: ['verify', 'build']
  },
  {
    id: 'implement-retry-logic',
    title: 'Implement a small retry helper',
    prompt: 'Implement a retry helper for flaky network calls and keep the API small.',
    route: 'implement',
    split: 'train',
    repo: { id: 'repo-beta', maturity: 'active' },
    routeHints: ['implement', 'verify'],
    checklistHints: ['Keep changes bounded', 'Run the smallest relevant tests'],
    tags: ['implement', 'network', 'retry']
  },
  {
    id: 'plan-legacy-cleanup',
    title: 'Plan a legacy config cleanup',
    prompt: 'Plan the migration from the legacy config shape to the new format.',
    route: 'plan',
    split: 'held-out',
    repo: { id: 'repo-beta', maturity: 'legacy' },
    routeHints: ['plan', 'ask'],
    checklistHints: ['Identify migration dependencies', 'Call out unknowns'],
    tags: ['plan', 'migration', 'legacy']
  },
  {
    id: 'explain-verification-failure',
    title: 'Explain a verification failure',
    prompt: 'Explain why the verification step is failing and what evidence supports that conclusion.',
    route: 'explain',
    split: 'held-out',
    repo: { id: 'repo-alpha', maturity: 'legacy' },
    routeHints: ['explain', 'verify'],
    checklistHints: ['Reference concrete evidence', 'Summarize the failure clearly'],
    tags: ['explain', 'failure', 'verify']
  }
]);
