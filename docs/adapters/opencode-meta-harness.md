# OpenCode meta-harness adapter

`packages/plugins/opencode-meta-harness` is the thin OpenCode-specific adapter package.

In the current slice, the shared adapter storage and observability behavior already lives in `packages/plugin-core`, and this package adds payload parsing, host-neutral mapping, and the real `createOpenCodeAdapter()` entrypoint.

For installation and setup, use the package README as the canonical guide: [`packages/plugins/opencode-meta-harness/README.md`](../../packages/plugins/opencode-meta-harness/README.md).

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

For the current retrieval-inspection slice, the OpenCode-specific mapping also includes a thin heuristic path for documented `tool.execute.before` payloads. That path only gates on a small allowlist of retrieval-like tool names (`read`, `grep`, `glob`, and `webfetch`), while args are merely observed from the host payload in this slice and are not interpreted or forwarded as retrieval policy input. It then routes the tracked task context into the existing `inspectRetrieval()` adapter seam with bounded, observational input.

## Current host integration slice

The package also exports a default OpenCode plugin module with id `opencode-meta-harness`.

The verified host integration for this slice is:

- `event` on `session.status` with `idle` → derive a best-effort local task-end request → call the thin adapter in shadow mode
- `event` on `session.idle` → compatibility fallback for the same best-effort local task-end request
- `experimental.session.compacting` → derive a best-effort local compaction request → call the thin adapter in shadow mode
- `tool.execute.before` on retrieval-like tool names → derive a best-effort heuristic retrieval inspection request → call the thin adapter in shadow mode

The implementation currently also derives task-start behavior from `chat.message`, but this adapter note treats that as current wiring rather than a formally documented public OpenCode hook contract.

This keeps the host-integration slice narrow while proving the package can be loaded as an actual OpenCode plugin module rather than only as a local library.

## Truth guardrails for this slice

- heuristic only: the plugin uses the allowlisted tool name from documented hooks as the retrieval-like signal, while args are only observed
- observational only: this is adapter seam wiring, not a provenance-grade host retrieval event
- no fabricated provenance: the plugin does not claim assistant-message identity, message authorship, or agent attribution for tool execution
- bounded mapping only: unsupported tool names are ignored, and the shared retrieval contract remains owned by `packages/core` and `packages/plugin-core`

Later OpenCode adapter work should keep calling those shared `packages/plugin-core` helpers rather than inventing new host-local storage schemas.
