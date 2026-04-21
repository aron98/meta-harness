import type { CanonicalFixture } from './canonical-fixture-schema';

export function renderFixtureSummary(fixture: CanonicalFixture): string {
  const lines = [
    `# ${fixture.title}`,
    '',
    `- Route: \`${fixture.route}\``,
    `- Repo: \`${fixture.repo.name}\` (\`${fixture.repo.maturity}\`)`,
    '',
    '## Prompt',
    '',
    fixture.prompt,
    '',
    '## Verification',
    ''
  ];

  if (fixture.expectations.mustPass.length === 0) {
    lines.push('- None');
  } else {
    for (const command of fixture.expectations.mustPass) {
      lines.push(`- \`${command}\``);
    }
  }

  return lines.join('\n');
}
