import { z } from 'zod';

export const fixtureAuthoringSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  route: z.enum(['explain', 'explore', 'plan', 'implement', 'verify', 'ask', 'challenge']),
  prompt: z.string().min(1),
  repo: z.object({
    name: z.string().min(1),
    maturity: z.enum(['new', 'active', 'legacy'])
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
