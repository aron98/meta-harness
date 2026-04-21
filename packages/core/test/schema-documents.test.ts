import { describe, expect, it } from 'vitest';

import { fixtureRouteSchema, repoMaturitySchema } from '../src/fixture-authoring-schema';
import { canonicalFixtureJsonSchema, fixtureAuthoringJsonSchema } from '../src/index';

function hasOwnProperty(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

describe('schema documents', () => {
  it('exports stable top-level metadata for the authoring schema document', () => {
    expect(fixtureAuthoringJsonSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'fixture-authoring.schema.json',
      title: 'Fixture Authoring',
      type: 'object',
      required: ['id', 'title', 'route', 'prompt', 'repo']
    });

    expect(hasOwnProperty(fixtureAuthoringJsonSchema, 'additionalProperties')).toBe(false);
    expect(fixtureAuthoringJsonSchema.properties.id).toMatchObject({
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    });
    expect(fixtureAuthoringJsonSchema.properties.title).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(fixtureAuthoringJsonSchema.properties.prompt).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(fixtureAuthoringJsonSchema.properties.route.enum).toEqual([
      'explain',
      'explore',
      'plan',
      'implement',
      'verify',
      'ask',
      'challenge'
    ]);
    expect(fixtureAuthoringJsonSchema.properties.repo.required).toEqual(['name', 'maturity']);
    expect(hasOwnProperty(fixtureAuthoringJsonSchema.properties.repo, 'additionalProperties')).toBe(false);
    expect(fixtureAuthoringJsonSchema.properties.repo.properties.name).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(fixtureAuthoringJsonSchema.properties.repo.properties.maturity.enum).toEqual([
      'new',
      'active',
      'legacy'
    ]);
  });

  it('exports stable top-level metadata for the canonical schema document', () => {
    expect(canonicalFixtureJsonSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'canonical-fixture.schema.json',
      title: 'Canonical Fixture',
      type: 'object',
      required: ['schemaVersion', 'id', 'slug', 'title', 'route', 'summary', 'prompt', 'repo', 'evidence', 'expectations', 'tags']
    });

    expect(hasOwnProperty(canonicalFixtureJsonSchema, 'additionalProperties')).toBe(false);
    expect(canonicalFixtureJsonSchema.properties.id).toMatchObject({
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    });
    expect(canonicalFixtureJsonSchema.properties.slug).toMatchObject({
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    });
    expect(canonicalFixtureJsonSchema.properties.title).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.summary).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.prompt).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.route.enum).toEqual([
      'explain',
      'explore',
      'plan',
      'implement',
      'verify',
      'ask',
      'challenge'
    ]);
    expect(hasOwnProperty(canonicalFixtureJsonSchema.properties.repo, 'additionalProperties')).toBe(false);
    expect(canonicalFixtureJsonSchema.properties.repo.properties.name).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.repo.properties.maturity.enum).toEqual([
      'new',
      'active',
      'legacy'
    ]);
    expect(canonicalFixtureJsonSchema.properties.evidence.properties.files.items).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.evidence.properties.commands.items).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.expectations.properties.mustPass.items).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.expectations.properties.notes.items).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
    expect(canonicalFixtureJsonSchema.properties.tags.items).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    });
  });

  it('copies runtime enum values into JSON schema enums', () => {
    expect(fixtureAuthoringJsonSchema.properties.route.enum).toEqual(fixtureRouteSchema.options);
    expect(canonicalFixtureJsonSchema.properties.route.enum).toEqual(fixtureRouteSchema.options);
    expect(fixtureAuthoringJsonSchema.properties.repo.properties.maturity.enum).toEqual(repoMaturitySchema.options);
    expect(canonicalFixtureJsonSchema.properties.repo.properties.maturity.enum).toEqual(repoMaturitySchema.options);

    expect(fixtureAuthoringJsonSchema.properties.route.enum).not.toBe(fixtureRouteSchema.options);
    expect(canonicalFixtureJsonSchema.properties.route.enum).not.toBe(fixtureRouteSchema.options);
    expect(fixtureAuthoringJsonSchema.properties.repo.properties.maturity.enum).not.toBe(repoMaturitySchema.options);
    expect(canonicalFixtureJsonSchema.properties.repo.properties.maturity.enum).not.toBe(repoMaturitySchema.options);
  });
});
