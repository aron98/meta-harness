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
- `packages/plugin-core` - host-neutral adapter contract package with a thin `policyInput` seam for future retrieval, routing, and verification tuning; policy ownership still stays in `packages/core`
- `packages/plugins/opencode-meta-harness` - OpenCode-specific thin adapter package, now able to parse OpenCode payloads, map them into the shared seam, and drive the shared lifecycle helpers
- `docs` - usage docs and generated/reference material

## Adapter observability status

`packages/plugin-core` now also owns the first shared adapter storage helpers for runtime task-start, task-end, and compaction records, plus bounded adapter-event observability records. Adapter-event files live under `data/runtime/adapter-events/<host-id>/<repo-id>/<task-id>/<operation>.json` and capture hook-level execution metadata without duplicating full artifact or memory payloads.

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

The CLI build prepares the required workspace package outputs first, so `pnpm --filter @meta-harness/cli build` is enough to make built CLI commands runnable from this repo checkout.

- `build-fixture-artifacts` - write fixture schemas and markdown into `docs/generated`
- `log-artifact` - validate and store an artifact record
- `promote-memory` - validate and store a memory record
- `query-history` - rank stored memory and artifact history
- `prepare-session` - build a session packet from stored history
- `evaluate-packet` - compare retrieval-on versus retrieval-off packet quality

For commands that accept structured input:

- use `--input '<json>'` for inline JSON
- or use `--input-file /path/to/input.json` for friendlier file-backed input
- add `--json` to emit machine-readable output instead of the default human-readable summaries
- warnings and failures use explicit prefixes such as `warning:` and `error: <command> failed: ...`

## Where to start

- Docs landing page: [`docs/README.md`](./docs/README.md)
- Architecture reference: [`docs/architecture/current-architecture.md`](./docs/architecture/current-architecture.md)
- Command reference: [`docs/commands/README.md`](./docs/commands/README.md)
- Full walkthrough: [`docs/usage/mvp-usage.md`](./docs/usage/mvp-usage.md)
- OpenCode plugin install guide: [`packages/plugins/opencode-meta-harness/README.md`](./packages/plugins/opencode-meta-harness/README.md)

## Adapter boundary status

`packages/plugin-core` now exposes the first host-neutral adapter seam for future plugin packages. It defines a shared adapter contract, thin lifecycle/storage/observability helpers, and a small optional `policyInput` object with `retrieval`, `routing`, and `verification` sections. That input is still pass-through only: adapters can forward it, but policy behavior remains in `packages/core`.
