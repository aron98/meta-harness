# `promote-memory`

Validate one memory record and store it under the matching scope path in `data/memory/`.

## Command

```bash
node apps/cli/dist/index.js promote-memory --data-root ./tmp/store --input-file ./memory.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

## Example input

```json
{
  "id": "memory-release-build-001",
  "scope": "repo-local",
  "repoId": "repo-alpha",
  "kind": "summary",
  "value": "For repo-alpha release checks, run pnpm build and pnpm test before reporting success.",
  "source": "artifact-analysis",
  "sourceArtifactIds": ["artifact-release-build-001"],
  "confidence": "high",
  "createdAt": "2026-04-21T12:05:00.000Z",
  "updatedAt": "2026-04-21T12:05:00.000Z"
}
```

## Human-readable output

```text
Promoted memory memory-release-build-001 (repo-local)
```

## JSON output

Add `--json` to emit `{ memoryId, filePath, memory }`.

## Notes

- Validation is handled by `parseMemoryRecord()` from `@meta-harness/core`.
- Scope rules come from the current `MemoryRecord` schema, for example `repo-local` requires `repoId` and `task-local` requires `taskId`.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
