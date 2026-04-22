# `compact-session`

Create a bounded typed compaction record and persist it under `data/runtime/compaction/<repo-id>/<task-id>.json`.

## Command

```bash
node apps/cli/dist/index.js compact-session --data-root ./tmp/store --input-file ./compaction.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

The current command also requires `taskId` in the input so it can write a stable runtime file path.

## Example input

```json
{
  "repoId": "repo-alpha",
  "taskId": "task-release-build-002",
  "taskText": "Verify the release build and report whether it passes with evidence.",
  "selectedMemoryIds": ["memory-release-build-001", "memory-release-build-002", "memory-release-build-003"],
  "selectedArtifactIds": ["artifact-release-build-001", "artifact-release-build-002"],
  "suggestedRoute": "verify",
  "verificationState": {
    "status": "passed",
    "checklist": ["Capture the exact verification command results and status.", "Run pnpm build.", "Run pnpm test."],
    "completedSteps": ["Capture the exact verification command results and status.", "Run pnpm build."]
  },
  "unresolvedQuestions": ["Should the smoke test run against staging or production?"],
  "compactedAt": "2026-04-21T12:15:00.000Z",
  "startedAt": "2026-04-21T12:10:00.000Z",
  "endedAt": "2026-04-21T12:14:12.000Z"
}
```

## Human-readable output

```text
Compacted task task-release-build-002 (verify) with 3 memory ids and 2 artifact ids
```

## JSON output

Add `--json` to emit `{ filePath, summary }`.

- `filePath` is the compaction file under `data/runtime/compaction/...`
- `summary` is the bounded validated `CompactionSummary`

## Notes

- The command uses `createCompactionSummary()` from `@meta-harness/core`.
- The helper keeps compaction typed and bounded instead of allowing an unstructured free-form note.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
