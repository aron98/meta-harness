# @meta-harness/opencode-meta-harness

Thin OpenCode adapter package, now functional for the current slice.

## Current slice

This package currently provides:

- OpenCode hook payload parsing
- mapping from OpenCode payload names into host-neutral `@meta-harness/plugin-core` input shapes
- a real `createOpenCodeAdapter()` entrypoint that composes the shared lifecycle, storage, and observability helpers

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
