import type { FixtureAuthoringRecord } from '@meta-harness/core';

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

export type FixtureCatalog = readonly DeepReadonly<FixtureAuthoringRecord>[];

export const fixtureDefinitions: FixtureCatalog = freezeDeep([
  {
    id: 'repo-scan-basic',
    title: 'Scan a small repository',
    route: 'explore',
    prompt:
      'Inspect the repository and report the main entry points, package manager, and test command.',
    repo: {
      name: 'demo-repo',
      maturity: 'active'
    },
    evidence: {
      files: ['package.json', 'src/index.ts'],
      commands: ['pnpm test']
    },
    expectations: {
      mustPass: ['pnpm test'],
      notes: ['Do not change code']
    },
    tags: ['explore', 'repo']
  },
  {
    id: 'verify-node-build',
    title: 'Verify a Node build flow',
    route: 'verify',
    prompt: 'Run the build and report whether it succeeds with evidence.',
    repo: {
      name: 'demo-repo',
      maturity: 'active'
    },
    evidence: {
      files: ['package.json'],
      commands: ['pnpm build']
    },
    expectations: {
      mustPass: ['pnpm build'],
      notes: ['Capture exit code 0']
    },
    tags: ['verify', 'build']
  }
]);
