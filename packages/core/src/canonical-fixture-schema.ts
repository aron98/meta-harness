import { z } from 'zod';

import { fixtureIdSchema, fixtureRouteSchema, repoMaturitySchema } from './fixture-authoring-schema';

const trimmedNonEmptyString = z.string().trim().min(1);

export const canonicalFixtureSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  id: fixtureIdSchema,
  slug: fixtureIdSchema,
  title: trimmedNonEmptyString,
  route: fixtureRouteSchema,
  summary: trimmedNonEmptyString,
  prompt: trimmedNonEmptyString,
  repo: z.object({
    name: trimmedNonEmptyString,
    maturity: repoMaturitySchema
  }),
  evidence: z.object({
    files: z.array(trimmedNonEmptyString),
    commands: z.array(trimmedNonEmptyString)
  }),
  expectations: z.object({
    mustPass: z.array(trimmedNonEmptyString),
    notes: z.array(trimmedNonEmptyString)
  }),
  tags: z.array(trimmedNonEmptyString)
});

export type CanonicalFixture = z.infer<typeof canonicalFixtureSchema>;
