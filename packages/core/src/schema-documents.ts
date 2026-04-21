const jsonSchemaDialect = 'https://json-schema.org/draft/2020-12/schema';

const requiredTextSchema = {
  type: 'string',
  minLength: 1,
  pattern: '.*\\S.*',
  description: 'Approximation of the runtime trim().min(1) check: requires at least one non-whitespace character.'
} as const;

const fixtureRouteEnum = ['explain', 'explore', 'plan', 'implement', 'verify', 'ask', 'challenge'] as const;
const repoMaturityEnum = ['new', 'active', 'legacy'] as const;

export const fixtureAuthoringJsonSchema = {
  $schema: jsonSchemaDialect,
  $id: 'fixture-authoring.schema.json',
  title: 'Fixture Authoring',
  type: 'object',
  required: ['id', 'title', 'route', 'prompt', 'repo'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    },
    title: requiredTextSchema,
    route: {
      type: 'string',
      enum: fixtureRouteEnum
    },
    prompt: requiredTextSchema,
    repo: {
      type: 'object',
      required: ['name', 'maturity'],
      properties: {
        name: requiredTextSchema,
        maturity: {
          type: 'string',
          enum: repoMaturityEnum
        }
      }
    },
    evidence: {
      type: 'object',
      required: ['files', 'commands'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          default: []
        },
        commands: {
          type: 'array',
          items: { type: 'string' },
          default: []
        }
      },
      default: {
        files: [],
        commands: []
      }
    },
    expectations: {
      type: 'object',
      required: ['mustPass', 'notes'],
      properties: {
        mustPass: {
          type: 'array',
          items: { type: 'string' },
          default: []
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          default: []
        }
      },
      default: {
        mustPass: [],
        notes: []
      }
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      default: []
    }
  }
} as const;

export const canonicalFixtureJsonSchema = {
  $schema: jsonSchemaDialect,
  $id: 'canonical-fixture.schema.json',
  title: 'Canonical Fixture',
  type: 'object',
  required: ['schemaVersion', 'id', 'slug', 'title', 'route', 'summary', 'prompt', 'repo', 'evidence', 'expectations', 'tags'],
  properties: {
    schemaVersion: {
      type: 'string',
      const: '1.0.0'
    },
    id: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    },
    slug: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    },
    title: requiredTextSchema,
    route: {
      type: 'string',
      enum: fixtureRouteEnum
    },
    summary: requiredTextSchema,
    prompt: requiredTextSchema,
    repo: {
      type: 'object',
      required: ['name', 'maturity'],
      properties: {
        name: requiredTextSchema,
        maturity: {
          type: 'string',
          enum: repoMaturityEnum
        }
      }
    },
    evidence: {
      type: 'object',
      required: ['files', 'commands'],
      properties: {
        files: {
          type: 'array',
          items: requiredTextSchema
        },
        commands: {
          type: 'array',
          items: requiredTextSchema
        }
      }
    },
    expectations: {
      type: 'object',
      required: ['mustPass', 'notes'],
      properties: {
        mustPass: {
          type: 'array',
          items: requiredTextSchema
        },
        notes: {
          type: 'array',
          items: requiredTextSchema
        }
      }
    },
    tags: {
      type: 'array',
      items: requiredTextSchema
    }
  }
} as const;
