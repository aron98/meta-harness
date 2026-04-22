# Meta-Harness docs

This directory documents the current local repo state for `code/`.

## Start here

- [Usage guide](./usage/mvp-usage.md) for the shipped CLI walkthrough commands in `apps/cli`, including the Phase 2 runtime bridge surface
- [Current architecture](./architecture/current-architecture.md) for the package boundaries, record schemas, retrieval pipeline, runtime bridge helpers, evaluation fixtures, and plugin placeholder
- [Command reference](./commands/README.md) for one page per shipped CLI command

## What these docs cover today

- `apps/cli` is the shipped command surface for generating fixture artifacts, logging artifacts, promoting memory, querying history, preparing session packets, simulating runtime task lifecycle hooks, inspecting retrieval explicitly, compacting active task state, and evaluating bundled benchmarks
- `packages/core` owns the record schemas, storage helpers, retrieval and ranking logic, packet preparation, runtime bridge types and helpers, and evaluation logic
- `packages/fixtures` supplies the benchmark fixtures used by packet evaluation
- `packages/plugin` is only a placeholder adapter surface today

## Recommended reading order

1. Start with [Usage guide](./usage/mvp-usage.md) if you want to run the current CLI end to end.
2. Use [Command reference](./commands/README.md) when you need the exact contract for one shipped command.
3. Read [Current architecture](./architecture/current-architecture.md) when you need the detailed explanation of how the packages and abstractions fit together.
