import { describe, expect, it } from 'vitest';

import { parseFixtureAuthoringSchema, type FixtureAuthoringRecord } from '../src/index';

const validFixture: FixtureAuthoringRecord = {
  id: 'repo-scan-basic',
  title: 'Scan a small repository',
  route: 'explore',
  prompt: 'Inspect repo structure and summarize key entry points.',
  repo: { name: 'demo-repo', maturity: 'active' },
  evidence: { files: ['src/index.ts'], commands: ['pnpm test'] },
  expectations: { mustPass: ['pnpm test'], notes: ['Summarize findings only'] },
  tags: ['repo', 'scan']
};

describe('parseFixtureAuthoringSchema', () => {
  it('accepts a valid authored fixture', () => {
    expect(parseFixtureAuthoringSchema(validFixture)).toEqual(validFixture);
  });

  it('defaults evidence, expectations, and tags when omitted', () => {
    expect(
      parseFixtureAuthoringSchema({
        id: 'repo-scan-basic',
        title: 'Scan a small repository',
        route: 'explore',
        prompt: 'Inspect repo structure and summarize key entry points.',
        repo: { name: 'demo-repo', maturity: 'active' }
      })
    ).toEqual({
      ...validFixture,
      evidence: { files: [], commands: [] },
      expectations: { mustPass: [], notes: [] },
      tags: []
    });
  });

  it('rejects an invalid id', () => {
    expect(() =>
      parseFixtureAuthoringSchema({
        ...validFixture,
        id: 'Repo Scan Basic'
      })
    ).toThrow();
  });

  it('rejects an invalid route', () => {
    expect(() =>
      parseFixtureAuthoringSchema({
        ...validFixture,
        route: 'ship'
      })
    ).toThrow();
  });

  it('rejects an invalid repo maturity', () => {
    expect(() =>
      parseFixtureAuthoringSchema({
        ...validFixture,
        repo: { ...validFixture.repo, maturity: 'stale' }
      })
    ).toThrow();
  });
});
