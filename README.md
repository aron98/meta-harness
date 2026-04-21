# meta-harness monorepo

`meta-harness` is a TypeScript pnpm workspace for a local, file-based harness loop. The repo already supports logging task artifacts, promoting scoped memory, retrieving prior evidence, preparing a session packet for a new task, and evaluating packet quality against benchmark fixtures.

## What the Current MVP Can Do

- log validated artifact records into `data/artifacts/<repo-id>/<artifact-id>.json`
- promote validated memory records into scoped files under `data/memory/`
- rank stored artifacts and memories for a retrieval query
- prepare a session packet from stored history with selected evidence, a suggested route, and a verification checklist
- evaluate retrieval-on versus retrieval-off packet generation over bundled benchmark fixtures
- generate fixture docs and schemas into `docs/generated`

## Workspace layout

- `apps/cli` - user-facing CLI for the current MVP
- `packages/core` - schemas, storage helpers, retrieval, packet prep, and evaluation logic
- `packages/fixtures` - bundled benchmark fixtures and generated fixture inputs
- `packages/plugin` - placeholder plugin adapter surface
- `docs` - usage docs and generated/reference material

## Install and verify

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## CLI commands

Run the built CLI from the repo root:

```bash
node apps/cli/dist/index.js --help
```

- `build-fixture-artifacts` - write fixture schemas and markdown into `docs/generated`
- `log-artifact` - validate and store an artifact record
- `promote-memory` - validate and store a memory record
- `query-history` - rank stored memory and artifact history
- `prepare-session` - build a session packet from stored history
- `evaluate-packet` - compare retrieval-on versus retrieval-off packet quality

## Where to start

- Full walkthrough: `docs/usage/mvp-usage.md`
- Command reference: `apps/cli/README.md`
