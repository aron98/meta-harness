# Command reference

This section documents the shipped CLI commands in `apps/cli/src/index.ts`.

Run commands from the repo root:

```bash
node apps/cli/dist/index.js <command> [...flags]
```

## Shared conventions

- Commands that accept structured input take either `--input '<json>'` or `--input-file /path/to/input.json`.
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

## Related docs

- [Docs landing page](../README.md)
- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
