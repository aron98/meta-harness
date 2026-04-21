import type { FixtureAuthoringRecord } from '@meta-harness/core';

import { describe, expect, it } from 'vitest';

import { fixtureDefinitions } from '@meta-harness/fixtures';

describe('fixtures package public surface', () => {
  it('exports a deeply immutable fixture catalog with unique ids', () => {
    const ids = fixtureDefinitions.map((fixture) => fixture.id);
    const firstFixture = fixtureDefinitions[0]!;

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
    expect(Object.isFrozen(fixtureDefinitions)).toBe(true);
    expect(Object.isFrozen(firstFixture)).toBe(true);
    expect(Object.isFrozen(firstFixture.evidence)).toBe(true);
    expect(Object.isFrozen(firstFixture.evidence.files)).toBe(true);
    expect(() => {
      (fixtureDefinitions as unknown as FixtureAuthoringRecord[]).push(
        firstFixture as unknown as FixtureAuthoringRecord
      );
    }).toThrow(TypeError);
    expect(() => {
      (firstFixture.evidence.files as unknown as string[]).push('README.md');
    }).toThrow(TypeError);
  });
});
