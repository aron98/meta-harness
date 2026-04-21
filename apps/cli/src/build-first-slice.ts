import { mkdir as defaultMkdir, writeFile as defaultWriteFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalFixtureJsonSchema,
  fixtureAuthoringJsonSchema,
  normalizeFixture,
  parseFixtureAuthoringSchema,
  renderFixtureSummary
} from '@meta-harness/core';
import { fixtureDefinitions } from '@meta-harness/fixtures';

type WriteFile = typeof import('node:fs/promises').writeFile;
type Mkdir = typeof import('node:fs/promises').mkdir;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const defaultOutputRoot = join(repoRoot, 'docs/generated');

export async function buildFirstSliceArtifacts(options: {
  outputRoot?: string;
  writeFile?: WriteFile;
  mkdir?: Mkdir;
} = {}): Promise<{ writtenFiles: string[] }> {
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  const writeFile = options.writeFile ?? defaultWriteFile;
  const mkdir = options.mkdir ?? defaultMkdir;
  const writtenFiles = [
    'schemas/fixture-authoring.schema.json',
    'schemas/canonical-fixture.schema.json'
  ];

  const canonicalFixtures = fixtureDefinitions.map((definition) => {
    parseFixtureAuthoringSchema(definition);
    return normalizeFixture(definition);
  });

  await mkdir(join(outputRoot, 'schemas'), { recursive: true });
  await mkdir(join(outputRoot, 'fixtures'), { recursive: true });

  await writeFile(
    join(outputRoot, 'schemas/fixture-authoring.schema.json'),
    `${JSON.stringify(fixtureAuthoringJsonSchema, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(outputRoot, 'schemas/canonical-fixture.schema.json'),
    `${JSON.stringify(canonicalFixtureJsonSchema, null, 2)}\n`,
    'utf8'
  );

  for (const fixture of canonicalFixtures) {
    const jsonPath = `fixtures/${fixture.id}.json`;
    const markdownPath = `fixtures/${fixture.id}.md`;

    await writeFile(join(outputRoot, jsonPath), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    await writeFile(join(outputRoot, markdownPath), `${renderFixtureSummary(fixture)}\n`, 'utf8');

    writtenFiles.push(jsonPath, markdownPath);
  }

  await writeFile(
    join(outputRoot, 'fixtures/index.md'),
    `${canonicalFixtures.map((fixture) => `- \`${fixture.id}\`: ${fixture.title}`).join('\n')}\n`,
    'utf8'
  );
  writtenFiles.push('fixtures/index.md');

  return { writtenFiles };
}
