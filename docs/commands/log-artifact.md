# `log-artifact`

Validate one artifact record and store it under `data/artifacts/<repo-id>/<artifact-id>.json`.

## Command

```bash
node apps/cli/dist/index.js log-artifact --data-root ./tmp/store --input-file ./artifact.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

## Example input

```json
{
  "id": "artifact-release-build-001",
  "taskType": "verification",
  "repoId": "repo-alpha",
  "taskId": "task-release-build-001",
  "promptSummary": "Verify the release build and capture the result.",
  "filesInspected": ["package.json", "pnpm-workspace.yaml"],
  "filesChanged": [],
  "commands": ["pnpm build"],
  "diagnostics": ["Build completed without TypeScript errors."],
  "verification": ["pnpm build", "pnpm test"],
  "outcome": "success",
  "tags": ["verify", "build", "release"],
  "createdAt": "2026-04-21T12:00:00.000Z"
}
```

## Human-readable output

```text
Logged artifact artifact-release-build-001 (success)
```

## JSON output

Add `--json` to emit:

```json
{
  "recordId": "artifact-release-build-001",
  "filePath": "./tmp/store/data/artifacts/repo-alpha/artifact-release-build-001.json",
  "record": {
    "id": "artifact-release-build-001"
  }
}
```

The full `record` object is the validated `ArtifactRecord` payload.

## Notes

- Validation is handled by `parseArtifactRecord()` from `@meta-harness/core`.
- On success, the command writes exactly one JSON file into the artifact store.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
