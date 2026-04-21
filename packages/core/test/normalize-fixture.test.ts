import { describe, expect, it } from 'vitest';

import { normalizeFixture } from '../src/index';

describe('normalizeFixture', () => {
  it('normalizes authored fixtures into deterministic canonical records', () => {
    expect(
      normalizeFixture({
        id: 'repo-scan-basic',
        title: '  Scan a small repository  ',
        route: 'explore',
        prompt: '  Inspect repo structure and summarize key entry points.  ',
        repo: {
          name: '  demo-repo  ',
          maturity: 'active'
        },
        evidence: {
          files: ['src/z.ts', '   ', 'src/a.ts', 'src/a.ts'],
          commands: ['pnpm test', ' ', 'pnpm lint', 'pnpm test']
        },
        expectations: {
          mustPass: [' pnpm test ', '   ', 'pnpm build', 'pnpm test', 'pnpm a11y'],
          notes: ['  zed note  ', ' ', 'alpha note', 'zed note']
        },
        tags: ['zebra', 'alpha', ' ', 'zebra', ' alpha ']
      })
    ).toEqual({
      schemaVersion: '1.0.0',
      id: 'repo-scan-basic',
      slug: 'repo-scan-basic',
      title: 'Scan a small repository',
      route: 'explore',
      summary: 'Scan a small repository [explore]',
      prompt: 'Inspect repo structure and summarize key entry points.',
      repo: {
        name: 'demo-repo',
        maturity: 'active'
      },
      evidence: {
        files: ['src/a.ts', 'src/z.ts'],
        commands: ['pnpm lint', 'pnpm test']
      },
      expectations: {
        mustPass: ['pnpm a11y', 'pnpm build', 'pnpm test'],
        notes: ['alpha note', 'zed note']
      },
      tags: ['alpha', 'zebra']
    });
  });

  it('rejects whitespace-only required strings after trimming', () => {
    expect(() =>
      normalizeFixture({
        id: 'repo-scan-basic',
        title: '   ',
        route: 'explore',
        prompt: 'Inspect repo structure and summarize key entry points.',
        repo: {
          name: 'demo-repo',
          maturity: 'active'
        }
      })
    ).toThrow();

    expect(() =>
      normalizeFixture({
        id: 'repo-scan-basic',
        title: 'Scan a small repository',
        route: 'explore',
        prompt: '   ',
        repo: {
          name: 'demo-repo',
          maturity: 'active'
        }
      })
    ).toThrow();

    expect(() =>
      normalizeFixture({
        id: 'repo-scan-basic',
        title: 'Scan a small repository',
        route: 'explore',
        prompt: 'Inspect repo structure and summarize key entry points.',
        repo: {
          name: '   ',
          maturity: 'active'
        }
      })
    ).toThrow();
  });

  it('drops whitespace-only entries from evidence arrays', () => {
    const fixture = normalizeFixture({
      id: 'repo-scan-basic',
      title: 'Scan a small repository',
      route: 'explore',
      prompt: 'Inspect repo structure and summarize key entry points.',
      repo: {
        name: 'demo-repo',
        maturity: 'active'
      },
      evidence: {
        files: ['src/z.ts', '   ', 'src/a.ts'],
        commands: ['pnpm test', ' ', 'pnpm lint']
      }
    });

    expect(fixture.evidence).toEqual({
      files: ['src/a.ts', 'src/z.ts'],
      commands: ['pnpm lint', 'pnpm test']
    });
  });
});
