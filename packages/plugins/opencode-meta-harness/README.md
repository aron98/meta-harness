# @meta-harness/opencode-meta-harness

Thin OpenCode adapter package, now functional for the current slice.

## Current slice

This package currently provides:

- OpenCode hook payload parsing
- mapping from OpenCode payload names into host-neutral `@meta-harness/plugin-core` input shapes
- a real `createOpenCodeAdapter()` entrypoint that composes the shared lifecycle, storage, and observability helpers
- a real OpenCode plugin module that hooks `chat.message` and derives a shadow-mode `startTask` call

The adapter still stays thin: retrieval, routing, verification policy, and durable record schemas remain owned by `@meta-harness/core` and the shared seam in `@meta-harness/plugin-core`.

## Example mapping

OpenCode payload:

```json
{
  "repoId": "repo-a",
  "taskId": "task-001",
  "taskText": "Inspect runtime flow",
  "taskType": "analysis"
}
```

Mapped host-neutral input:

```json
{
  "repoId": "repo-a",
  "taskId": "task-001",
  "taskText": "Inspect runtime flow",
  "taskType": "analysis"
}
```

## Current host integration slice

The default export is now an OpenCode plugin module with id `opencode-meta-harness`.

In this first host-integration slice it wires only the `chat.message` hook. That hook derives a local task-start request from the real OpenCode message/session payload, then calls the existing thin adapter in shadow mode.
