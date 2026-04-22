# OpenCode meta-harness adapter

`packages/plugins/opencode-meta-harness` is the thin OpenCode-specific adapter package.

In the current slice, the shared adapter storage and observability behavior already lives in `packages/plugin-core`, and this package adds payload parsing, host-neutral mapping, and the real `createOpenCodeAdapter()` entrypoint.

## Adapter-event path

Host-level observability records are written under:

```text
data/runtime/adapter-events/opencode/<repo-id>/<task-id>/<operation>.json
```

These records are intentionally separate from artifact and memory storage.

- artifact and memory stores remain core-owned durable records
- adapter-event records capture hook-level execution metadata for debugging host mapping and lifecycle flow
- they stay bounded and reference selected ids instead of duplicating full payloads

## Current mapping slice

OpenCode hook payload:

```json
{
  "repoId": "repo-a",
  "taskId": "task-001",
  "taskText": "Inspect runtime flow",
  "taskType": "analysis"
}
```

Mapped host-neutral adapter input:

```json
{
  "repoId": "repo-a",
  "taskId": "task-001",
  "taskText": "Inspect runtime flow",
  "taskType": "analysis"
}
```

The mapping layer only renames and forwards values. The adapter factory then composes that mapping with the shared `packages/plugin-core` lifecycle, storage, and observability helpers. Retrieval, routing, and verification policy still belong to `packages/core` and the shared seam in `packages/plugin-core`.

## Current host integration slice

The package now also exports a default OpenCode plugin module with id `opencode-meta-harness`.

That plugin currently wires these real host hooks:

- `chat.message` → derive a local task-start request → call the thin adapter in shadow mode
- `event` on `session.status` with `idle` → derive a best-effort local task-end request → call the thin adapter in shadow mode
- `event` on `session.idle` → compatibility fallback for the same best-effort local task-end request

This still keeps the host-integration slice narrow while proving the package can be loaded as an actual OpenCode plugin module rather than only as a local library.

Later OpenCode adapter work should keep calling those shared `packages/plugin-core` helpers rather than inventing new host-local storage schemas.
