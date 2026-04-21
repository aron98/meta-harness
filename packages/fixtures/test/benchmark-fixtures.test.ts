import { describe, expect, it } from 'vitest';

import { fixtureRouteSchema, repoMaturitySchema } from '@meta-harness/core';

import { benchmarkFixtures } from '../src/index';

describe('benchmarkFixtures', () => {
  it('exports a small diverse benchmark set for evaluation', () => {
    expect(benchmarkFixtures.length).toBeGreaterThanOrEqual(5);
    expect(new Set(benchmarkFixtures.map((fixture) => fixture.repo.id)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(benchmarkFixtures.map((fixture) => fixture.repo.maturity)).size).toBeGreaterThanOrEqual(2);
    expect(benchmarkFixtures.some((fixture) => fixture.split === 'held-out')).toBe(true);
  });

  it('covers the required route families and provides route and checklist hints', () => {
    const routes = new Set(benchmarkFixtures.map((fixture) => fixture.route));

    expect(routes.has('explore')).toBe(true);
    expect(routes.has('verify')).toBe(true);
    expect(routes.has('implement')).toBe(true);
    expect(routes.has('plan')).toBe(true);
    expect(routes.has('explain')).toBe(true);

    for (const fixture of benchmarkFixtures) {
      expect(fixture.routeHints.length).toBeGreaterThan(0);
      expect(fixture.checklistHints.length).toBeGreaterThan(0);
      expect(fixtureRouteSchema.parse(fixture.route)).toBe(fixture.route);
      expect(repoMaturitySchema.parse(fixture.repo.maturity)).toBe(fixture.repo.maturity);
    }
  });

  it('uses benchmark fixture ids without the phase1 prefix', () => {
    for (const fixture of benchmarkFixtures) {
      expect(fixture.id.startsWith('phase1-')).toBe(false);
    }
  });
});
