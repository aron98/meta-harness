# `inspect-retrieval`

Load stored history, rank records for a retrieval query, and print the selected memory and artifact entries with scores and reasons.

## Command

```bash
node apps/cli/dist/index.js inspect-retrieval --data-root ./tmp/store --input-file ./inspect.json
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
  "maxMemories": 1,
  "maxArtifacts": 1
}
```

`maxMemories` and `maxArtifacts` are optional. When present, they must be non-negative integers.

## Human-readable output

```text
Selected memories:
- memory-release-build-001 score=19.99950396825397 reasons=repo-match, tag-overlap, recent (memory)
Selected artifacts:
- artifact-release-build-001 score=34.99900793650794 reasons=repo-match, tag-overlap, recent, task-type-match, outcome-match (artifact)
```

If malformed stored files are present, warning lines are printed before the selected record blocks.

## JSON output

Add `--json` to emit `{ query, inspection, warnings }`.

- `query` is the normalized `RetrievalQuery`
- `inspection.selectedMemories` and `inspection.selectedArtifacts` are the copied scored entries returned by `inspectRetrieval()`
- `warnings` mirrors any skipped malformed history files

## Notes

- The command keeps retrieval inspection explicit and separate from memory promotion.
- Ranking uses the same `rankMemories()` and `rankArtifacts()` helpers as the existing packet-preparation path.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
