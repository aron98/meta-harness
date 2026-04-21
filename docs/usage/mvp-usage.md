# MVP Usage Guide

This walkthrough uses the real built CLI contract and a temporary local data store.

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

## 5. Evaluate the packet pipeline

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

## Cleanup

Remove the temp store when you are done:

```bash
rm -rf "$DATA_ROOT"
```
