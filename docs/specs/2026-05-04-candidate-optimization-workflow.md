# Candidate Optimization Workflow Design

## Goal

Turn the existing candidate search loop into an externally configurable, evidence-grade optimization workflow. The workflow should let users run bounded experiments over custom fixtures, candidate policies, mutation catalogs, and objective weights while preserving strict train/held-out separation and producing enough trace evidence to explain why a candidate won.

## Current State

The released candidate loop already supports typed candidate policies, a fixed mutation catalog, train-only winner selection, selected-winner held-out validation, persisted candidate artifacts, and the `run-candidate-search` CLI. The current limits are that the CLI always uses bundled fixtures, the default search space is hardcoded, objective weights are hardcoded, context packing limits are run-level options rather than candidate policy dimensions, traces do not explain score components deeply enough, and there is no command to export the winning policy as a runtime-ready artifact.

## Design

### Configurable Inputs

`run-candidate-search` keeps the current zero-config path, but its JSON input gains optional file paths:

- `fixturesFile` for custom benchmark fixtures.
- `candidatesFile` for explicit candidate policies.
- `searchConfigFile` for full `CandidateSearchConfigInput`, including `mutations`, `maxCombinationSize`, `maxCandidates`, and `includeDefaultMutations`.
- `mutationsFile` as a backward-compatible shorthand for standalone mutation arrays only.
- `objectiveFile` for metric weights and penalties.

Do not provide both `mutationsFile` and `searchConfigFile` in the same CLI input.

The CLI resolves paths relative to the current working directory unless absolute. Every file is parsed through strict schemas in `@meta-harness/core`; malformed config fails before any run artifacts are written.

### Candidate Policy Dimensions

The candidate policy gains a `context` section with `maxMemories` and `maxArtifacts`. These values allow non-negative integers so users can run zero-record ablations. Run-level `maxMemories` and `maxArtifacts` remain accepted for backward compatibility, but candidate context values take precedence when present.

Candidate policy continues to own retrieval, routing, and verification settings in core. The design intentionally does not mutate OpenCode or plugin config directly.

### Bounded Search Space

The search engine supports three sources of candidates:

1. Explicit candidates from `candidatesFile`.
2. Baseline plus single mutations from a catalog.
3. Baseline plus bounded mutation combinations when `maxCombinationSize` is configured.

Combination generation is deterministic, deduplicated, and capped. This keeps local search safe while making interactions between dimensions testable.

### Objective Configuration

The objective becomes data-driven with defaults matching current behavior. Configurable weights cover packet completeness, route hit rate, expected tag hit rate, verification checklist coverage, selected record penalty, and selected command penalty. Winner selection remains deterministic with the same tie-break shape: score, then fewer records, then candidate id.

### Evidence and Leakage Safety

Per-fixture traces include score contributions, selected record ids, selected command count, expected tag hits, route decisions, and the effective candidate policy. `selection.json` records both search and held-out summaries after held-out validation completes. Held-out traces are still produced only for the selected winner and never affect winner selection.

### Winner Export

Add an `export-candidate-policy` command that reads a run `selection.json` plus the selected candidate snapshot and writes a runtime policy artifact to a requested output path. The command does not edit user OpenCode config. This gives users a safe handoff from optimization evidence to runtime/plugin configuration.

## Acceptance Criteria

- `run-candidate-search` can run with bundled defaults exactly as before.
- `run-candidate-search` can run with custom fixture, candidate, mutation, and objective config files.
- Zero-record context ablations are supported through candidate policy and CLI input.
- Search can evaluate bounded mutation combinations without unbounded explosion.
- Winner selection remains train-only; held-out validation remains selected-winner-only.
- Artifacts explain why a candidate won through score components and trace data.
- A winner can be exported as a runtime policy artifact without mutating user config.
- Docs describe the configurable workflow, examples, and safe release/publish boundary.
- No npm tagging or publishing happens until Aron explicitly approves the end-of-milestone release.
