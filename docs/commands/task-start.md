# `task-start`

Build a runtime task context from stored history and persist it under `data/runtime/task-start/<repo-id>/<task-id>.json`.

## Command

```bash
node apps/cli/dist/index.js task-start --data-root ./tmp/store --input-file ./task-start.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

The current command also requires `taskId` in the input so it can write a stable runtime file path.

## Example input

```json
{
  "packetId": "packet-release-build-001",
  "repoId": "repo-alpha",
  "taskId": "task-release-build-002",
  "prompt": "Verify the release build and report whether it passes with evidence.",
  "routeHints": ["verify"],
  "maxMemories": 2,
  "maxArtifacts": 2,
  "referenceTime": "2026-04-21T12:10:00.000Z"
}
```

## Human-readable output

```text
Prepared runtime context packet-release-build-001 for task task-release-build-002 (verification/verify)
Selected 1 memories and 1 artifacts
```

Warnings for malformed stored files are printed before the summary lines.

## JSON output

Add `--json` to emit `{ filePath, taskStart, context, warnings }`.

- `filePath` is the runtime context file under `data/runtime/task-start/...`
- `taskStart` is the typed `TaskStartEvent`
- `context` is the full `RuntimeTaskContext`
- `warnings` mirrors any skipped malformed history files

## Notes

- The command loads stored history with the same helpers used by `query-history` and `prepare-session`.
- The runtime payload is built by `createTaskStartContext()` from `@meta-harness/core`.
- This command prepares runtime state only. It does not promote memory automatically.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
