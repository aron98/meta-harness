import { describe, expect, it } from 'vitest';

import { parseFixtureAuthoringSchema } from '@meta-harness/core';

import { fixtureDefinitions } from '../src/index';

describe('fixtureDefinitions', () => {
  it('exports exactly the two starter fixtures', () => {
    expect(fixtureDefinitions).toHaveLength(2);
    expect(fixtureDefinitions.map((fixture) => fixture.id)).toEqual([
      'repo-scan-basic',
      'verify-node-build'
    ]);
  });

  it('round-trips each fixture through the authoring schema', () => {
    expect(fixtureDefinitions.map((fixture) => parseFixtureAuthoringSchema(fixture))).toEqual(
      fixtureDefinitions
    );
  });
});
