import { describe, expect, it } from 'vitest';

import { normalizeFixture, renderFixtureSummary } from '../src/index';

describe('renderFixtureSummary', () => {
  it('renders canonical fixture fields as markdown in a stable order', () => {
    const fixture = normalizeFixture({
      id: 'repo-scan-basic',
      title: 'Scan a small repository',
      route: 'explore',
      prompt: 'Inspect repo structure and summarize key entry points.',
      repo: {
        name: 'demo-repo',
        maturity: 'active'
      },
      expectations: {
        mustPass: ['pnpm build', 'pnpm test']
      }
    });

    expect(renderFixtureSummary(fixture)).toBe([
      '# Scan a small repository',
      '',
      '- Route: `explore`',
      '- Repo: `demo-repo` (`active`)',
      '',
      '## Prompt',
      '',
      'Inspect repo structure and summarize key entry points.',
      '',
      '## Verification',
      '',
      '- `pnpm build`',
      '- `pnpm test`'
    ].join('\n'));
  });

  it('renders an explicit empty verification section when there are no must-pass commands', () => {
    const fixture = normalizeFixture({
      id: 'repo-scan-basic',
      title: 'Scan a small repository',
      route: 'explore',
      prompt: 'Inspect repo structure and summarize key entry points.',
      repo: {
        name: 'demo-repo',
        maturity: 'active'
      }
    });

    expect(renderFixtureSummary(fixture).split('\n')).toContain('- None');
  });
});
