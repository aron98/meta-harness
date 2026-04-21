# @meta-harness/cli

Phase 1 CLI for the local, file-based harness loop.

Build the workspace first:

```bash
pnpm install
pnpm build
```

Then run commands from the repo root with:

```bash
node apps/cli/dist/index.js <command> [...flags]
```

For commands that accept `--input`, pass one JSON object as a single shell argument.

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
- `--input '<json>'`

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

## `promote-memory`

Purpose: validate one memory record and persist it under the scope-specific `data/memory/...` path.

Required flags:

- `--data-root <path>`
- `--input '<json>'`

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

## `query-history`

Purpose: load stored memory and artifact records, rank them for a retrieval query, and print the top IDs.

Required flags:

- `--data-root <path>`
- `--input '<json>'`

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

Result object shape in code: `{ query, memories, artifacts, warnings }`.

## `prepare-session`

Purpose: build a session packet from stored history for a new task prompt.

Required flags:

- `--data-root <path>`
- `--input '<json>'`

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

Result object shape in code: `{ packet, warnings }`, where `packet` includes `id`, `taskType`, `selectedMemoryIds`, `selectedArtifactIds`, `suggestedRoute`, `verificationChecklist`, `rationale`, and `createdAt`.

## `evaluate-packet`

Purpose: evaluate bundled benchmark fixtures against the current store and print the retrieval-on versus retrieval-off comparison JSON.

Required flags:

- `--data-root <path>`

Rough output shape:

```text
Evaluated 5 benchmark packet(s)
{"benchmarks":[...],"summary":{"benchmarkCount":5,"retrievalOn":{...},"retrievalOff":{...},"comparison":{...}}}
```
