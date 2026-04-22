# `task-end`

Capture a typed runtime completion payload, persist it under `data/runtime/task-end/<repo-id>/<task-id>.json`, and derive a durable artifact record in `data/artifacts/<repo-id>/<artifact-id>.json`.

## Command

```bash
node apps/cli/dist/index.js task-end --data-root ./tmp/store --input-file ./task-end.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

The current command also requires `taskId` in the input so it can write a stable runtime file path.

## Example input

```json
{
  "id": "task-end-001",
  "repoId": "repo-alpha",
  "taskId": "task-release-build-002",
  "taskType": "verification",
  "taskText": "Verify the release build and report whether it passes with evidence.",
  "promptSummary": "Verified the release build and captured the result with supporting evidence.",
  "selectedMemoryIds": ["memory-release-build-001"],
  "selectedArtifactIds": ["artifact-release-build-001"],
  "suggestedRoute": "verify",
  "verificationState": {
    "status": "passed",
    "checklist": ["Capture the exact verification command results and status.", "Run pnpm build.", "Run pnpm test."],
    "completedSteps": ["Capture the exact verification command results and status.", "Run pnpm build.", "Run pnpm test."]
  },
  "unresolvedQuestions": [],
  "filesInspected": ["package.json", "pnpm-workspace.yaml"],
  "filesChanged": [],
  "commands": ["pnpm build", "pnpm test"],
  "diagnostics": ["Build completed without TypeScript errors.", "Tests passed in the release workspace."],
  "outcome": "success",
  "tags": ["verify", "build", "release"],
  "startedAt": "2026-04-21T12:10:00.000Z",
  "endedAt": "2026-04-21T12:14:12.000Z"
}
```

## Human-readable output

```text
Captured task end task-end-001 as artifact task-end-001 (success)
```

## JSON output

Add `--json` to emit `{ eventFilePath, artifactFilePath, event, record }`.

- `eventFilePath` is the runtime task-end file under `data/runtime/task-end/...`
- `artifactFilePath` is the durable artifact record path under `data/artifacts/...`
- `event` is the validated `TaskEndEvent`
- `record` is the derived durable `ArtifactRecord`

## Notes

- Validation is handled by `parseTaskEndEvent()` from `@meta-harness/core`.
- Artifact shaping is handled by `createTaskEndArtifact()`, which adds verification state into the durable record.
- This command captures completion automatically, but memory promotion remains a separate explicit command.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
