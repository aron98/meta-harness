# Command reference

This section documents the shipped CLI commands in `apps/cli/src/index.ts`.

Run commands from the repo root:

```bash
node apps/cli/dist/index.js <command> [...flags]
```

## Shared conventions

- Commands that accept structured input take either `--input '<json>'` or `--input-file /path/to/input.json`.
- File paths inside command input JSON are resolved relative to the current working directory unless a command says otherwise.
- Add `--json` when you want machine-readable output instead of the default summary lines.
- Human-readable warnings use the `warning:` prefix.
- Command failures use `error: <command> failed: ...`.

## Shipped commands

- [`build-fixture-artifacts`](./build-fixture-artifacts.md), generate fixture schemas and markdown under `docs/generated`
- [`log-artifact`](./log-artifact.md), validate and persist one artifact record
- [`promote-memory`](./promote-memory.md), validate and persist one memory record
- [`task-start`](./task-start.md), build and persist a runtime task context from stored history
- [`task-end`](./task-end.md), capture runtime completion and derive a durable artifact record
- [`inspect-retrieval`](./inspect-retrieval.md), inspect selected records, scores, and reasons explicitly
- [`compact-session`](./compact-session.md), persist a bounded typed runtime compaction summary
- [`query-history`](./query-history.md), rank stored artifacts and memories for a retrieval query
- [`prepare-session`](./prepare-session.md), build a session packet from stored history
- [`evaluate-packet`](./evaluate-packet.md), compare retrieval-on and retrieval-off packet quality over bundled fixtures
- [`run-candidate-search`](./run-candidate-search.md), evaluate bounded candidate policies and validate the selected winner
- [`export-candidate-policy`](./export-candidate-policy.md), export the selected candidate policy to a runtime artifact without mutating user config

## Candidate optimization examples

Use the example bundle from the repo root after building the CLI:

```bash
node apps/cli/dist/index.js run-candidate-search \
  --data-root ./tmp/candidate-optimization-store \
  --input-file ./docs/examples/candidate-optimization/input.json

node apps/cli/dist/index.js export-candidate-policy \
  --data-root ./tmp/candidate-optimization-store \
  --run-id docs-candidate-optimization \
  --output-file ./tmp/candidate-optimization-store/winner-policy.json
```

The export command writes only `winner-policy.json`. Applying that policy to OpenCode or another runtime is a separate, explicit action.

## Related docs

- [Docs landing page](../README.md)
- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
