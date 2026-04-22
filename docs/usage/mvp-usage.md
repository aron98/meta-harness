# MVP Usage Guide

This walkthrough uses the real built CLI contract and a temporary local data store.

## Scope of this guide

This document covers the current shipped CLI walkthrough. It describes the `apps/cli` workflow for logging artifacts, promoting memory, querying history, preparing session packets, simulating runtime task lifecycle hooks, explicitly inspecting retrieval, compacting active task state, and evaluating packet quality.

The shipped CLI also includes `build-fixture-artifacts` for generating `docs/generated` outputs, but that command is documented in `../commands/build-fixture-artifacts.md` rather than this walkthrough.

If you need the current architecture view, including `TaskStartEvent`, `RuntimeTaskContext`, retrieval inspection, task-end artifact creation, and compaction helpers, see `../architecture/current-architecture.md`.

## Prerequisites

From the repo root:

```bash
pnpm install
pnpm build
DATA_ROOT="$(mktemp -d)"
```

Notes:

- commands that take structured input accept either inline `--input '<json>'` or `--input-file /path/to/file.json`
- add `--json` when you want machine-readable output instead of summary lines
- warnings and failures use explicit prefixes such as `warning:` and `error: <command> failed: ...`

## 1. Log an artifact

```bash
cat > "$DATA_ROOT/artifact.json" <<'EOF'
{"id":"artifact-release-build-001","taskType":"verification","repoId":"repo-alpha","taskId":"task-release-build-001","promptSummary":"Verify the release build and capture the result.","filesInspected":["package.json","pnpm-workspace.yaml"],"filesChanged":[],"commands":["pnpm build"],"diagnostics":["Build completed without TypeScript errors."],"verification":["pnpm build","pnpm test"],"outcome":"success","tags":["verify","build","release"],"createdAt":"2026-04-21T12:00:00.000Z"}
EOF
node apps/cli/dist/index.js log-artifact --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/artifact.json"
```

Expected output:

```text
Logged artifact artifact-release-build-001 (success)
```

This writes `data/artifacts/repo-alpha/artifact-release-build-001.json` under `$DATA_ROOT`.

Machine-readable form:

```bash
node apps/cli/dist/index.js log-artifact --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/artifact.json" --json
```

## 2. Promote memory

```bash
cat > "$DATA_ROOT/memory.json" <<'EOF'
{"id":"memory-release-build-001","scope":"repo-local","repoId":"repo-alpha","kind":"summary","value":"For repo-alpha release checks, run pnpm build and pnpm test before reporting success.","source":"artifact-analysis","sourceArtifactIds":["artifact-release-build-001"],"confidence":"high","createdAt":"2026-04-21T12:05:00.000Z","updatedAt":"2026-04-21T12:05:00.000Z"}
EOF
node apps/cli/dist/index.js promote-memory --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/memory.json"
```

Expected output:

```text
Promoted memory memory-release-build-001 (repo-local)
```

This writes `data/memory/repo-local/repo-alpha/memory-release-build-001.json` under `$DATA_ROOT`.

## 3. Query history

```bash
node apps/cli/dist/index.js query-history --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/query.json"
```

Prepare the query file first:

```bash
cat > "$DATA_ROOT/query.json" <<'EOF'
{"repoId":"repo-alpha","taskType":"verification","tags":["verify","build","release"],"preferredOutcome":"success","referenceTime":"2026-04-21T12:10:00.000Z","limit":2}
EOF
```

Expected output:

```text
Top memories: memory-release-build-001
Top artifacts: artifact-release-build-001
```

The CLI prints the top IDs. In code, the command result also carries scored `memories`, `artifacts`, and any `warnings` for skipped malformed files.

If malformed files are present in the store, the human-readable command prints lines such as `warning: skipped memory record bad-memory.json` before the summaries.

## 4. Prepare a session packet

```bash
cat > "$DATA_ROOT/packet.json" <<'EOF'
{"packetId":"packet-release-build-001","repoId":"repo-alpha","taskId":"task-release-build-002","prompt":"Verify the release build and report whether it passes with evidence.","routeHints":["verify"],"maxMemories":2,"maxArtifacts":2,"referenceTime":"2026-04-21T12:10:00.000Z"}
EOF
node apps/cli/dist/index.js prepare-session --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/packet.json"
```

Expected output:

```text
Prepared session packet packet-release-build-001 (verification/verify)
Selected 1 memories and 1 artifacts
```

The CLI prints only the two summary lines above.

Add `--json` to receive the full `{ packet, warnings }` payload on stdout.

In code, the successful command result also carries a `packet` object containing:

- `id`: `packet-release-build-001`
- `taskType`: `verification`
- `selectedMemoryIds`: `['memory-release-build-001']`
- `selectedArtifactIds`: `['artifact-release-build-001']`
- `suggestedRoute`: `verify`
- `verificationChecklist`: checklist items derived from task type plus retrieved evidence

## 5. Start runtime task context

```bash
cat > "$DATA_ROOT/task-start.json" <<'EOF'
{"packetId":"packet-release-build-001","repoId":"repo-alpha","taskId":"task-release-build-002","prompt":"Verify the release build and report whether it passes with evidence.","routeHints":["verify"],"maxMemories":2,"maxArtifacts":2,"referenceTime":"2026-04-21T12:10:00.000Z"}
EOF
node apps/cli/dist/index.js task-start --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/task-start.json"
```

Expected output:

```text
Prepared runtime context packet-release-build-001 for task task-release-build-002 (verification/verify)
Selected 1 memories and 1 artifacts
```

This writes `data/runtime/task-start/repo-alpha/task-release-build-002.json` under `$DATA_ROOT`.

## 6. Inspect retrieval explicitly

```bash
cat > "$DATA_ROOT/inspect.json" <<'EOF'
{"repoId":"repo-alpha","taskType":"verification","tags":["verify","build","release"],"preferredOutcome":"success","referenceTime":"2026-04-21T12:10:00.000Z","maxMemories":1,"maxArtifacts":1}
EOF
node apps/cli/dist/index.js inspect-retrieval --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/inspect.json"
```

Expected output starts with:

```text
Selected memories:
- memory-release-build-001
Selected artifacts:
- artifact-release-build-001
```

The full human-readable lines also include the scored retrieval reasons.

## 7. Capture runtime task completion

```bash
cat > "$DATA_ROOT/task-end.json" <<'EOF'
{"id":"task-end-001","repoId":"repo-alpha","taskId":"task-release-build-002","taskType":"verification","taskText":"Verify the release build and report whether it passes with evidence.","promptSummary":"Verified the release build and captured the result with supporting evidence.","selectedMemoryIds":["memory-release-build-001"],"selectedArtifactIds":["artifact-release-build-001"],"suggestedRoute":"verify","verificationState":{"status":"passed","checklist":["Capture the exact verification command results and status.","Run pnpm build.","Run pnpm test."],"completedSteps":["Capture the exact verification command results and status.","Run pnpm build.","Run pnpm test."]},"unresolvedQuestions":[],"filesInspected":["package.json","pnpm-workspace.yaml"],"filesChanged":[],"commands":["pnpm build","pnpm test"],"diagnostics":["Build completed without TypeScript errors.","Tests passed in the release workspace."],"outcome":"success","tags":["verify","build","release"],"startedAt":"2026-04-21T12:10:00.000Z","endedAt":"2026-04-21T12:14:12.000Z"}
EOF
node apps/cli/dist/index.js task-end --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/task-end.json"
```

Expected output:

```text
Captured task end task-end-001 as artifact task-end-001 (success)
```

This writes:

- `data/runtime/task-end/repo-alpha/task-release-build-002.json`
- `data/artifacts/repo-alpha/task-end-001.json`

## 8. Compact active task state

```bash
cat > "$DATA_ROOT/compaction.json" <<'EOF'
{"repoId":"repo-alpha","taskId":"task-release-build-002","taskText":"Verify the release build and report whether it passes with evidence.","selectedMemoryIds":["memory-release-build-001","memory-release-build-002","memory-release-build-003"],"selectedArtifactIds":["artifact-release-build-001","artifact-release-build-002"],"suggestedRoute":"verify","verificationState":{"status":"passed","checklist":["Capture the exact verification command results and status.","Run pnpm build.","Run pnpm test."],"completedSteps":["Capture the exact verification command results and status.","Run pnpm build."]},"unresolvedQuestions":["Should the smoke test run against staging or production?"],"compactedAt":"2026-04-21T12:15:00.000Z","startedAt":"2026-04-21T12:10:00.000Z","endedAt":"2026-04-21T12:14:12.000Z"}
EOF
node apps/cli/dist/index.js compact-session --data-root "$DATA_ROOT" --input-file "$DATA_ROOT/compaction.json"
```

Expected output:

```text
Compacted task task-release-build-002 (verify) with 3 memory ids and 2 artifact ids
```

This writes `data/runtime/compaction/repo-alpha/task-release-build-002.json` under `$DATA_ROOT`.

Memory promotion is still explicit. The runtime bridge commands do not create `MemoryRecord`s automatically.

## 9. Evaluate the packet pipeline

```bash
node apps/cli/dist/index.js evaluate-packet --data-root "$DATA_ROOT"
```

Expected output starts with:

```text
Evaluated 5 benchmark packet(s)
```

The next line is a JSON object with:

- `benchmarks`: per-fixture retrieval-on and retrieval-off packet results
- `summary.benchmarkCount`: total benchmark count
- `summary.retrievalOn`: averaged metrics with stored history enabled
- `summary.retrievalOff`: averaged metrics with stored history disabled
- `summary.comparison`: delta metrics between the two modes

Add `--json` to emit a single machine-readable payload: `{ evaluation, warnings }`.

## Related docs

- Architecture reference: `../architecture/current-architecture.md`
- Docs landing page: `../README.md`
