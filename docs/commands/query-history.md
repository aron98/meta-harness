# `query-history`

Load stored memory and artifact records, rank them for a retrieval query, and print the top matching IDs.

## Command

```bash
node apps/cli/dist/index.js query-history --data-root ./tmp/store --input-file ./query.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

## Example input

```json
{
  "repoId": "repo-alpha",
  "taskType": "verification",
  "tags": ["verify", "build", "release"],
  "preferredOutcome": "success",
  "referenceTime": "2026-04-21T12:10:00.000Z",
  "limit": 2
}
```

`limit` is optional. The current command defaults it to `3`, and it must be a positive integer.

## Human-readable output

```text
Top memories: memory-release-build-001
Top artifacts: artifact-release-build-001
```

If malformed stored files are present, the command prints warning lines such as `warning: skipped memory record bad-memory.json` before the summaries.

## JSON output

Add `--json` to emit:

```json
{
  "query": {
    "repoId": "repo-alpha",
    "taskType": "verification",
    "tags": ["verify", "build", "release"],
    "preferredOutcome": "success",
    "referenceTime": "2026-04-21T12:10:00.000Z"
  },
  "memories": [],
  "artifacts": [],
  "warnings": []
}
```

The `memories` and `artifacts` arrays contain scored retrieval entries, not just record IDs.

## Notes

- The command recursively scans JSON files under `data/artifacts` and `data/memory`.
- Stored files that fail JSON parsing or schema validation are skipped with warnings instead of aborting the command.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
