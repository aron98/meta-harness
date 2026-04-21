import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { fixtureDefinitions } from '@meta-harness/fixtures';

import { buildFixtureArtifacts } from '../src/build-first-slice';

describe('buildFixtureArtifacts', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('writes schemas, canonical fixtures, summaries, and an index', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-'));
    tempDirectories.push(outputRoot);
    const fixtureArtifactPaths = fixtureDefinitions.flatMap((fixture) => [
      `fixtures/${fixture.id}.json`,
      `fixtures/${fixture.id}.md`
    ]);

    const result = await buildFixtureArtifacts({ outputRoot });

    expect(result.writtenFiles).toEqual(expect.arrayContaining([
      'schemas/fixture-authoring.schema.json',
      'schemas/canonical-fixture.schema.json',
      ...fixtureArtifactPaths,
      'fixtures/index.md'
    ]));
    expect(result.writtenFiles).toHaveLength(3 + fixtureArtifactPaths.length);

    await expect(readFile(join(outputRoot, 'schemas/fixture-authoring.schema.json'), 'utf8')).resolves.toContain(
      'Fixture Authoring'
    );
    await expect(readFile(join(outputRoot, 'schemas/canonical-fixture.schema.json'), 'utf8')).resolves.toContain(
      'Canonical Fixture'
    );

    for (const fixture of fixtureDefinitions) {
      await expect(readFile(join(outputRoot, `fixtures/${fixture.id}.json`), 'utf8')).resolves.toContain(fixture.id);
      await expect(readFile(join(outputRoot, `fixtures/${fixture.id}.md`), 'utf8')).resolves.toContain(`# ${fixture.title}`);
    }

    const indexContent = await readFile(join(outputRoot, 'fixtures/index.md'), 'utf8');
    for (const fixture of fixtureDefinitions) {
      expect(indexContent).toContain(`- \`${fixture.id}\`: ${fixture.title}`);
    }
  });

  it('anchors the default output root to the repo instead of the current working directory', async () => {
    const originalCwd = process.cwd();
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'meta-harness-cli-cwd-'));
    tempDirectories.push(outsideDirectory);
    const mkdir = async () => undefined;
    const writeTargets: string[] = [];
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

    process.chdir(outsideDirectory);

    try {
      await buildFixtureArtifacts({
        mkdir,
        writeFile: async (filePath) => {
          writeTargets.push(String(filePath));
        }
      });
    } finally {
      process.chdir(originalCwd);
    }

    expect(writeTargets[0]).toBe(join(repoRoot, 'docs/generated/schemas/fixture-authoring.schema.json'));
  });
});
