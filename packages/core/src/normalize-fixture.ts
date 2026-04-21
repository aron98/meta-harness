import { canonicalFixtureSchema, type CanonicalFixture } from './canonical-fixture-schema';
import { parseFixtureAuthoringSchema } from './fixture-authoring-schema';

function trimList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function sortUnique(values: string[]): string[] {
  // Canonical fixtures use deterministic string arrays everywhere.
  return [...new Set(trimList(values))].sort();
}

export function normalizeFixture(input: unknown): CanonicalFixture {
  const fixture = parseFixtureAuthoringSchema(input);
  const title = fixture.title.trim();
  const prompt = fixture.prompt.trim();
  const repoName = fixture.repo.name.trim();

  return canonicalFixtureSchema.parse({
    schemaVersion: '1.0.0',
    id: fixture.id,
    slug: fixture.id,
    title,
    route: fixture.route,
    summary: `${title} [${fixture.route}]`,
    prompt,
    repo: {
      name: repoName,
      maturity: fixture.repo.maturity
    },
    evidence: {
      files: sortUnique(fixture.evidence.files),
      commands: sortUnique(fixture.evidence.commands)
    },
    expectations: {
      mustPass: sortUnique(fixture.expectations.mustPass),
      notes: sortUnique(fixture.expectations.notes)
    },
    tags: sortUnique(fixture.tags)
  });
}
