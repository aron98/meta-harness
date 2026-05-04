# Candidate Optimization Workflow Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Follow TDD: write the failing test, run it red, implement minimal code, run it green, then commit only when the controller explicitly approves. Implementation subagents must not spawn nested subagents.

**Goal:** Build a configurable, evidence-grade candidate optimization workflow with custom inputs, bounded combinations, objective config, richer traces, and winner export.

**Architecture:** Keep policy ownership in `packages/core`. Add strict schemas and pure helpers in focused candidate modules, then thread those helpers into the CLI. Preserve existing defaults so current callers keep working.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm workspace, Changesets only when release is later approved.

---

## File Structure

- Create `packages/core/src/candidates/objective-config.ts` for objective schema, defaults, and scoring helpers.
- Create `packages/core/src/candidates/search-config.ts` for search-space config, candidate file schemas, and bounded combination generation helpers.
- Modify `packages/core/src/candidates/candidate.ts` to add optional `context` policy limits.
- Modify `packages/core/src/candidates/evaluate-candidate.ts` to apply candidate context and return score contributions.
- Modify `packages/core/src/candidates/search-objective.ts` to delegate to configurable objective helpers while preserving defaults.
- Modify `packages/core/src/candidates/run-candidate-search.ts` to accept objective/search config and write richer selection metadata.
- Modify `packages/core/src/candidates/candidate-store.ts` if trace/summary persistence needs extra output helpers.
- Create `packages/core/src/candidates/export-candidate-policy.ts` for safe winner export.
- Modify `packages/core/src/index.ts` to export new public APIs.
- Modify `apps/cli/src/run-candidate-search.ts` to load optional config files and allow non-negative context limits.
- Create `apps/cli/src/export-candidate-policy.ts` and wire it in `apps/cli/src/index.ts`.
- Add or extend tests under `packages/core/test/candidates/` and `apps/cli/test/`.
- Update `docs/commands/run-candidate-search.md`, add `docs/commands/export-candidate-policy.md`, update `docs/commands/README.md`, `docs/architecture/current-architecture.md`, and root `README.md`.

---

## Chunk 1: Candidate context and objective config

### Task 1: Add candidate context policy

**Files:**
- Modify: `packages/core/src/candidates/candidate.ts`
- Modify: `packages/core/src/candidates/candidate-policy.ts`
- Modify: `packages/core/src/candidates/evaluate-candidate.ts`
- Test: `packages/core/test/candidates/candidate.test.ts`
- Test: `packages/core/test/candidates/evaluate-candidate.test.ts`

- [ ] Write a failing test that parses a candidate with `policy.context.maxMemories: 0` and `maxArtifacts: 0`.
- [ ] Run `pnpm vitest run packages/core/test/candidates/candidate.test.ts` and confirm it fails because `context` is not accepted.
- [ ] Add `candidateContextPolicySchema` with non-negative integer `maxMemories` and `maxArtifacts`, optional on `candidatePolicySchema` for backward compatibility.
- [ ] Run the candidate schema test and confirm it passes.
- [ ] Write a failing evaluation test showing candidate context limits override run-level limits.
- [ ] Run `pnpm vitest run packages/core/test/candidates/evaluate-candidate.test.ts` and confirm it fails for the missing override.
- [ ] Thread candidate context into `evaluatePacketBenchmarks` by passing effective `maxMemories`/`maxArtifacts` from candidate context first, then input fallback.
- [ ] Run both candidate/evaluation tests and confirm they pass.

### Task 2: Add configurable objective scoring

**Files:**
- Create: `packages/core/src/candidates/objective-config.ts`
- Modify: `packages/core/src/candidates/search-objective.ts`
- Modify: `packages/core/src/candidates/evaluate-candidate.ts`
- Test: `packages/core/test/candidates/search-objective.test.ts`

- [ ] Write failing tests for default objective parity with current scoring.
- [ ] Write failing tests for custom `expectedTagHitRateWeight`, `selectedCommandPenalty`, and deterministic tie breaks.
- [ ] Run `pnpm vitest run packages/core/test/candidates/search-objective.test.ts` and confirm failures.
- [ ] Implement strict objective schema with defaults: `packetCompletenessWeight: 1`, `routeHitRateWeight: 1`, `verificationChecklistCoverageWeight: 1`, `expectedTagHitRateWeight: 0`, `selectedRecordPenalty: 0.01`, `selectedCommandPenalty: 0`.
- [ ] Return score contributions alongside total score with exact keys: `packetCompleteness`, `routeHitRate`, `verificationChecklistCoverage`, `expectedTagHitRate`, `selectedRecordPenalty`, `selectedCommandPenalty`.
- [ ] Update `scoreCandidateSummary` and `selectCandidateSearchWinner` to accept optional objective config.
- [ ] Preserve exact winner tie-break order: score descending, `summary.metrics.selectedRecordCount` ascending, then `candidateId` ascending by locale compare.
- [ ] Run objective tests green.

---

## Chunk 2: Search-space config and richer traces

### Task 3: Add custom mutation catalog and bounded combinations

**Files:**
- Create: `packages/core/src/candidates/search-config.ts`
- Modify: `packages/core/src/candidates/mutation-catalog.ts`
- Modify: `packages/core/src/candidates/run-candidate-search.ts`
- Test: `packages/core/test/candidates/mutation-catalog.test.ts`
- Test: `packages/core/test/candidates/run-candidate-search.test.ts`

- [ ] Write failing tests for parsing a custom mutation catalog.
- [ ] Write failing tests for deterministic pairwise combinations with `maxCombinationSize: 2` and an explicit candidate cap.
- [ ] Run targeted tests and confirm they fail.
- [ ] Implement search config schema: `mutations`, `maxCombinationSize`, `maxCandidates`, `includeDefaultMutations`. `mutations` is an array of existing `CandidateMutation` objects. `maxCombinationSize` is an integer 1-3. `maxCandidates` is a positive integer and includes the baseline candidate in the count. `includeDefaultMutations` defaults to true when no custom `mutations` are provided and false when custom `mutations` are provided.
- [ ] Implement deterministic candidate generation from baseline plus mutation combinations. Combination ordering must be: baseline first, single mutations in catalog order, then size-2 combinations in lexicographic index order `[0,1]`, `[0,2]`, `[1,2]`, then size-3 combinations in the same index-recursive order.
- [ ] Generated combination candidate ids must be `candidate-${mutationIdA}__${mutationIdB}` for combinations and the mutation id itself for single mutations. Labels must join mutation labels with ` + `. `mutationIds` must preserve combination order.
- [ ] Enforce bounds with clear errors when generated candidates exceed `maxCandidates`; exact message shape: `candidate search generated ${actual} candidates, which exceeds maxCandidates ${maxCandidates}`.
- [ ] Run targeted tests green.

### Task 4: Preserve explicit candidates and train-only selection

**Files:**
- Modify: `packages/core/src/candidates/run-candidate-search.ts`
- Test: `packages/core/test/candidates/run-candidate-search.test.ts`
- Test: `packages/core/test/candidates/validate-held-out.test.ts`

- [ ] Write failing tests showing explicit candidates bypass mutation generation.
- [ ] Write a regression test proving held-out fixtures do not affect winner selection even with custom objective config.
- [ ] Run targeted tests and confirm red.
- [ ] Pass explicit candidates through strict parsing and objective config through scoring.
- [ ] Keep held-out validation outside winner selection.
- [ ] Run targeted tests green.

### Task 5: Add score contributions and trace evidence

**Files:**
- Modify: `packages/core/src/candidates/evaluate-candidate.ts`
- Modify: `packages/core/src/candidates/candidate-store.ts`
- Modify: `packages/core/src/candidates/run-candidate-search.ts`
- Test: `packages/core/test/candidates/evaluate-candidate.test.ts`
- Test: `packages/core/test/candidates/candidate-store.test.ts`

- [ ] Write failing tests that traces include `scoreContributions`, selected record ids, selected command count, route decision, expected tag hit rate, and effective policy.
- [ ] Run targeted tests red.
- [ ] Extend trace types and persistence without removing existing fields.
- [ ] Update selection metadata after held-out validation to include search and held-out summaries.
- [ ] Run targeted tests green.

---

## Chunk 3: CLI config loading and winner export

### Task 6: Load custom config files in `run-candidate-search`

**Files:**
- Modify: `apps/cli/src/run-candidate-search.ts`
- Test: `apps/cli/test/run-candidate-search.test.ts`
- Modify: `docs/commands/run-candidate-search.md`

- [ ] Write failing CLI tests for `fixturesFile`, `candidatesFile`, `searchConfigFile`, `mutationsFile`, and `objectiveFile`.
- [ ] Write failing CLI test for `maxMemories: 0` and `maxArtifacts: 0`.
- [ ] Run `pnpm vitest run apps/cli/test/run-candidate-search.test.ts` and confirm red.
- [ ] Add safe JSON file loading with absolute/relative path handling. Input JSON field names are exactly `fixturesFile`, `candidatesFile`, `searchConfigFile`, `mutationsFile`, and `objectiveFile`; all relative paths resolve against `process.cwd()`, not against the input JSON file location.
- [ ] Parse custom fixtures through the same benchmark fixture schema used by core.
- [ ] Treat `searchConfigFile` as full `CandidateSearchConfigInput`, including `mutations`, `maxCombinationSize`, `maxCandidates`, and `includeDefaultMutations`.
- [ ] Treat `mutationsFile` as a backward-compatible shorthand for standalone JSON arrays of `CandidateMutation` objects only, then pass it to core as `searchConfig.mutations`.
- [ ] Reject CLI input that provides both `mutationsFile` and `searchConfigFile`.
- [ ] Pass loaded candidates/search config/objective config into `runCandidateSearch` and `validateHeldOut`.
- [ ] Allow non-negative integer context limits.
- [ ] Run CLI tests green.

### Task 7: Add `export-candidate-policy` command

**Files:**
- Create: `packages/core/src/candidates/export-candidate-policy.ts`
- Modify: `packages/core/src/index.ts`
- Create: `apps/cli/src/export-candidate-policy.ts`
- Modify: `apps/cli/src/index.ts`
- Test: `packages/core/test/candidates/export-candidate-policy.test.ts`
- Test: `apps/cli/test/export-candidate-policy.test.ts`
- Docs: `docs/commands/export-candidate-policy.md`, `docs/commands/README.md`

- [ ] Write failing core test that reads a selected candidate snapshot and writes a runtime policy artifact.
- [ ] Write failing CLI tests for required args, JSON output, and refusal to mutate OpenCode config.
- [ ] Run targeted tests red.
- [ ] Implement core export helper reading `selection.json` and `candidates/<id>/candidate.json`.
- [ ] Implement CLI command requiring `--data-root`, `--run-id`, and `--output-file`.
- [ ] Wire help text and command dispatch.
- [ ] Run targeted tests green.

---

## Chunk 4: Documentation, verification, and release boundary

### Task 8: Update docs and examples

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/current-architecture.md`
- Modify: `docs/commands/run-candidate-search.md`
- Create: `docs/examples/candidate-optimization/fixtures.json`
- Create: `docs/examples/candidate-optimization/mutations.json`
- Create: `docs/examples/candidate-optimization/objective.json`
- Create: `docs/examples/candidate-optimization/candidates.json`

- [ ] Update command docs with configurable input examples.
- [ ] Document train/held-out leakage safety.
- [ ] Document winner export workflow and that it does not mutate user config.
- [ ] Add example JSON files that are valid against schemas.
- [ ] Run docs-related tests if any schemas validate generated docs; otherwise run full `pnpm test` later.

### Task 9: Full verification

**Files:** all modified files.

- [ ] Run LSP diagnostics on all modified TypeScript files.
- [ ] Run targeted candidate tests.
- [ ] Run `pnpm vitest run apps/cli/test/index.test.ts` after wiring `export-candidate-policy` because CLI help and dispatch are modified.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run a built CLI smoke for `run-candidate-search` using bundled defaults.
- [ ] Run a built CLI smoke for `run-candidate-search` using docs example config files.
- [ ] Run a built CLI smoke for `export-candidate-policy` against the generated run.
- [ ] Confirm no `as any`, `@ts-ignore`, or `@ts-expect-error` were introduced.

---

## Commit guidance

Do not commit unless the controller has explicit approval. When approved, split commits by atomic unit: context/objective schema, search config, trace evidence, CLI config loading, winner export, docs/examples. Every git command must use `GIT_MASTER=1`.

## Release boundary

Do not add a changeset, create package tags, or publish npm packages until Aron explicitly says the milestone is complete and release should start.
