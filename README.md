# meta-harness monorepo

`meta-harness` is a TypeScript pnpm workspace for a local, file-based harness loop. The repo already supports logging task artifacts, promoting scoped memory, retrieving prior evidence, preparing a session packet for a new task, and evaluating packet quality against benchmark fixtures.

## Install for OpenCode

Most users should install the OpenCode plugin directly:

```bash
npx @meta-harness/opencode-meta-harness install
```

This patches your global OpenCode config and stores plugin data under `$XDG_DATA_HOME/opencode-meta-harness` or `~/.local/share/opencode-meta-harness`. See the [OpenCode plugin package guide](./packages/plugins/opencode-meta-harness/README.md) for dry runs, generated config shape, and repo-checkout development setup.

The same npm CLI supports `install` for first-time global setup, `doctor` to check install, config, and version health, and `upgrade` to check npm for a newer version and update the OpenCode config when appropriate.

## What the Current MVP Can Do

- log validated artifact records into `data/artifacts/<repo-id>/<artifact-id>.json`
- promote validated memory records into scoped files under `data/memory/`
- rank stored artifacts and memories for a retrieval query
- prepare a session packet from stored history with selected evidence, a suggested route, and a verification checklist
- evaluate retrieval-on versus retrieval-off packet generation over bundled benchmark fixtures
- define and evaluate bounded candidate policies for local harness-evaluation experiments
- generate fixture docs and schemas into `docs/generated`

Candidate policies live in `packages/core/src/candidates/` and are intentionally bounded to retrieval weights, routing order/prompt mode, and verification toggles. The search loop tunes this small core-owned policy input over the current heuristics; adapter packages only pass compatible policy input through and do not own policy behavior. A baseline candidate looks like:

```json
{
  "id": "baseline",
  "label": "Baseline policy",
  "createdAt": "2026-04-26T00:00:00.000Z",
  "mutationIds": [],
  "policy": {
    "retrieval": {
      "repoMatchWeight": 10,
      "tagOverlapWeight": 3,
      "recentMaxBonus": 4,
      "recentHalfLifeDays": 7,
      "taskTypeWeight": 8,
      "outcomeWeight": 4,
      "taskLocalMemoryBonus": 1
    },
    "routing": {
      "taskTypeOrder": ["verification", "planning", "documentation", "fix", "codegen", "analysis"],
      "buildPromptMode": "default"
    },
    "verification": {
      "includeArtifactVerificationCommands": true,
      "includeMemoryCommandHints": true,
      "requirePromptClarificationOnUnclear": true
    }
  }
}
```

Candidate-run artifacts are rooted under paths such as `data/candidate-runs/run-001/candidates/baseline/candidate.json`. The first local search path evaluates baseline plus bounded mutations on fixtures where `split === "train"`, computes a scalar score from packet completeness, route hit rate, checklist coverage, and a small selected-record penalty, then writes `run.json`, `selection.json`, summaries, and per-fixture traces. Held-out fixtures are evaluated only for the already selected winner and are recorded separately under `held-out/` without changing the search winner.

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

## Release flow

Published workspace packages use Changesets for independent versions, a reviewed version PR on `main`, automatic per-package tags after the version PR merges, and a manual `publish.yml` dispatch with an immutable package tag or exact commit SHA as the only publish trigger. See [`docs/releasing.md`](./docs/releasing.md).

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
- `run-candidate-search` - run bounded local candidate search and held-out winner validation

For commands that accept structured input:

- use `--input '<json>'` for inline JSON
- or use `--input-file /path/to/input.json` for friendlier file-backed input
- add `--json` to emit machine-readable output instead of the default human-readable summaries
- warnings and failures use explicit prefixes such as `warning:` and `error: <command> failed: ...`

## Where to start

- Docs landing page: [`docs/README.md`](./docs/README.md)
- Release process: [`docs/releasing.md`](./docs/releasing.md)
- Architecture reference: [`docs/architecture/current-architecture.md`](./docs/architecture/current-architecture.md)
- Command reference: [`docs/commands/README.md`](./docs/commands/README.md)
- Full walkthrough: [`docs/usage/mvp-usage.md`](./docs/usage/mvp-usage.md)
- OpenCode plugin install guide: [`packages/plugins/opencode-meta-harness/README.md`](./packages/plugins/opencode-meta-harness/README.md)

## Adapter boundary status

`packages/plugin-core` now exposes the first host-neutral adapter seam for future plugin packages. It defines a shared adapter contract, thin lifecycle/storage/observability helpers, and a small optional `policyInput` object with `retrieval`, `routing`, and `verification` sections. That input is still pass-through only: adapters can forward it, but policy behavior remains in `packages/core`.
