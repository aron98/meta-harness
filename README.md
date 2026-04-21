# meta-harness monorepo

Initial TypeScript pnpm workspace scaffold for the OpenCode meta-harness project.

## Workspace layout

- `packages/core` - shared schemas and tiny core helpers
- `packages/plugin` - placeholder plugin adapter surface
- `packages/fixtures` - reusable test fixtures
- `apps/cli` - minimal CLI entrypoint

## Commands

- `corepack pnpm install` - install workspace dependencies
- `corepack pnpm build` - build all packages and apps with tsup
- `corepack pnpm test` - run Vitest across the workspace
- `corepack pnpm typecheck` - run TypeScript typechecks across the workspace
- `corepack pnpm lint` - currently aliases typecheck to keep the scaffold lean

If `pnpm` is already available on your machine, the same commands also work without the `corepack` prefix.

## Notes

- `zod` is installed only in `packages/core`, where runtime schema parsing belongs.
- The plugin package is intentionally a placeholder adapter and does not implement harness behavior yet.
