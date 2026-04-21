import { describe, expect, it } from 'vitest';

import { fixtureRouteSchema, repoMaturitySchema } from '@meta-harness/core';

import { phase1BenchmarkFixtures } from '../src/index';

describe('phase1BenchmarkFixtures', () => {
  it('exports a small diverse benchmark set for phase 1 evaluation', () => {
    expect(phase1BenchmarkFixtures.length).toBeGreaterThanOrEqual(5);
    expect(new Set(phase1BenchmarkFixtures.map((fixture) => fixture.repo.id)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(phase1BenchmarkFixtures.map((fixture) => fixture.repo.maturity)).size).toBeGreaterThanOrEqual(2);
    expect(phase1BenchmarkFixtures.some((fixture) => fixture.split === 'held-out')).toBe(true);
  });

  it('covers the required route families and provides route and checklist hints', () => {
    const routes = new Set(phase1BenchmarkFixtures.map((fixture) => fixture.route));

    expect(routes.has('explore')).toBe(true);
    expect(routes.has('verify')).toBe(true);
    expect(routes.has('implement')).toBe(true);
    expect(routes.has('plan')).toBe(true);
    expect(routes.has('explain')).toBe(true);

    for (const fixture of phase1BenchmarkFixtures) {
      expect(fixture.routeHints.length).toBeGreaterThan(0);
      expect(fixture.checklistHints.length).toBeGreaterThan(0);
      expect(fixtureRouteSchema.parse(fixture.route)).toBe(fixture.route);
      expect(repoMaturitySchema.parse(fixture.repo.maturity)).toBe(fixture.repo.maturity);
    }
  });
});
