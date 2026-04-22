# `prepare-session`

Build a session packet from stored history for a new task prompt.

## Command

```bash
node apps/cli/dist/index.js prepare-session --data-root ./tmp/store --input-file ./packet.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

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
Prepared session packet packet-release-build-001 (verification/verify)
Selected 1 memories and 1 artifacts
```

Warnings for malformed stored files are printed before the summary lines.

## JSON output

Add `--json` to emit `{ packet, warnings }`.

The current `packet` shape includes:

- `id`
- `repoId`
- `taskType`
- optional `taskId`
- `selectedMemoryIds`
- `selectedArtifactIds`
- `suggestedRoute`
- `verificationChecklist`
- `rationale`
- `createdAt`

## Notes

- The command loads stored records with the same helpers used by `query-history`.
- The packet is built by `prepareSessionPacket()` in `@meta-harness/core`, which classifies the prompt, recommends a route, ranks evidence, and builds the verification checklist.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
