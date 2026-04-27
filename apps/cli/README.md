# @meta-harness/cli

CLI for the local, file-based harness loop.

Build the workspace first:

```bash
pnpm install
pnpm build
```

Then run commands from the repo root with:

```bash
node apps/cli/dist/index.js <command> [...flags]
```

For commands that accept structured input:

- use `--input '<json>'` to pass one JSON object as a single shell argument
- or use `--input-file /path/to/input.json` to load the same payload from disk
- add `--json` when you want machine-readable output instead of the default human-readable summary

Warnings and failures use explicit prefixes such as `warning:` and `error: <command> failed: ...`.

## `build-fixture-artifacts`

Purpose: write generated fixture schemas and fixture markdown into `docs/generated`.

Required flags:

- none

Rough output shape:

```text
Wrote files:
- schemas/fixture-authoring.schema.json
- schemas/canonical-fixture.schema.json
- fixtures/<fixture-id>.json
- fixtures/<fixture-id>.md
- fixtures/index.md
```

## `log-artifact`

Purpose: validate one artifact record and persist it under `data/artifacts/<repo-id>/<artifact-id>.json`.

Required flags:

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

Sample `--input` JSON:

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

Rough output shape:

```text
Logged artifact artifact-release-build-001 (success)
```

JSON mode:

```bash
node apps/cli/dist/index.js log-artifact --data-root ./tmp/store --input-file ./artifact.json --json
```

```json
{
  "recordId": "artifact-release-build-001",
  "filePath": "./tmp/store/data/artifacts/repo-alpha/artifact-release-build-001.json",
  "record": {"id": "artifact-release-build-001"}
}
```

## `promote-memory`

Purpose: validate one memory record and persist it under the scope-specific `data/memory/...` path.

Required flags:

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

Sample `--input` JSON:

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

Rough output shape:

```text
Promoted memory memory-release-build-001 (repo-local)
```

JSON mode returns `{ memoryId, filePath, memory }`.

## `query-history`

Purpose: load stored memory and artifact records, rank them for a retrieval query, and print the top IDs.

Required flags:

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

Sample `--input` JSON:

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

Rough output shape:

```text
Top memories: memory-release-build-001
Top artifacts: artifact-release-build-001
```

Warnings for malformed stored records are printed as `warning: skipped ...` in human-readable mode.

JSON mode returns `{ query, memories, artifacts, warnings }`.

## `prepare-session`

Purpose: build a session packet from stored history for a new task prompt.

Required flags:

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

Sample `--input` JSON:

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

Rough output shape:

```text
Prepared session packet packet-release-build-001 (verification/verify)
Selected 1 memories and 1 artifacts
```

Warnings for malformed stored records are printed as `warning: skipped ...` in human-readable mode.

JSON mode returns `{ packet, warnings }`, where `packet` includes `id`, `taskType`, `selectedMemoryIds`, `selectedArtifactIds`, `suggestedRoute`, `verificationChecklist`, `rationale`, and `createdAt`.

## `evaluate-packet`

Purpose: evaluate bundled benchmark fixtures against the current store and print the retrieval-on versus retrieval-off comparison JSON.

Required flags:

- `--data-root <path>`

Rough output shape:

```text
Evaluated 5 benchmark packet(s)
{"benchmarks":[...],"summary":{"benchmarkCount":5,"retrievalOn":{...},"retrievalOff":{...},"comparison":{...}}}
```

Warnings for malformed stored records are printed as `warning: skipped ...` in human-readable mode.

JSON mode returns `{ evaluation, warnings }`.

## `run-candidate-search`

Purpose: evaluate bounded candidate policies against bundled benchmark fixtures, select one winner on train fixtures, and validate that winner on held-out fixtures.

Required flags:

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

Sample `--input` JSON:

```json
{
  "runId": "candidate-smoke",
  "referenceTime": "2026-04-26T12:00:00.000Z",
  "maxMemories": 2,
  "maxArtifacts": 2
}
```

Rough output shape:

```text
Candidate search run candidate-smoke
Winner: baseline (score 0.95)
Train fixtures: 1
Held-out fixtures: 1
Held-out score: 0.9
Selection: ./tmp/store/data/candidate-runs/candidate-smoke/selection.json
```

The command writes `data/candidate-runs/<run-id>/run.json`, `selection.json`, candidate configs, search traces, and held-out traces under `--data-root`.

JSON mode returns `{ search, heldOut, warnings, paths }`.
