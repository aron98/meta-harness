import { z } from 'zod';

export const fixtureIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const fixtureRouteSchema = z.enum([
  'explain',
  'explore',
  'plan',
  'implement',
  'verify',
  'ask',
  'challenge'
]);
export const repoMaturitySchema = z.enum(['new', 'active', 'legacy']);

const requiredTextSchema = z.string().trim().min(1);

export const fixtureAuthoringSchema = z.object({
  id: fixtureIdSchema,
  title: requiredTextSchema,
  route: fixtureRouteSchema,
  prompt: requiredTextSchema,
  repo: z.object({
    name: requiredTextSchema,
    maturity: repoMaturitySchema
  }),
  evidence: z
    .object({
      files: z.array(z.string()).default([]),
      commands: z.array(z.string()).default([])
    })
    .default({ files: [], commands: [] }),
  expectations: z
    .object({
      mustPass: z.array(z.string()).default([]),
      notes: z.array(z.string()).default([])
    })
    .default({ mustPass: [], notes: [] }),
  tags: z.array(z.string()).default([])
});

export type FixtureAuthoringRecord = z.infer<typeof fixtureAuthoringSchema>;

export function parseFixtureAuthoringSchema(input: unknown): FixtureAuthoringRecord {
  return fixtureAuthoringSchema.parse(input);
}
