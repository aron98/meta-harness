# `run-candidate-search`

Evaluate bounded candidate policies, select one winner on the train split, and validate that winner on held-out fixtures. By default the command uses bundled benchmark fixtures, but the input JSON can point to custom fixture, candidate, search-config, mutation-array shorthand, and objective files.

## Command

```bash
node apps/cli/dist/index.js run-candidate-search --data-root ./tmp/store --input-file ./tmp/store/candidate-run.json
```

Runnable example files are available under `docs/examples/candidate-optimization/`. From the repo root:

```bash
node apps/cli/dist/index.js run-candidate-search \
  --data-root ./tmp/candidate-optimization-store \
  --input-file ./docs/examples/candidate-optimization/input.json
```

## Required flags

- `--data-root <path>`
- one of `--input '<json>'` or `--input-file <path>`

## Input JSON

```json
{
  "runId": "candidate-smoke",
  "referenceTime": "2026-04-26T12:00:00.000Z",
  "maxMemories": 2,
  "maxArtifacts": 2,
  "fixturesFile": "./candidate-input/fixtures.json",
  "searchConfigFile": "./candidate-input/search-config.json",
  "objectiveFile": "./candidate-input/objective.json"
}
```

All fields except `runId` are optional. If `referenceTime` is omitted, the command uses the current clock time. `referenceTime` must be an ISO datetime string such as `2026-04-26T12:00:00.000Z`.

`maxMemories` and `maxArtifacts` are non-negative integers, so `0` is valid when you want to evaluate an empty runtime context.

## Custom input files

The file fields are exactly:

- `fixturesFile`, a JSON array of benchmark fixtures parsed with the same schema core uses for candidate benchmarking.
- `candidatesFile`, a JSON array of complete candidate objects. When present, these explicit candidates bypass mutation-generated candidates.
- `searchConfigFile`, a full `CandidateSearchConfigInput` object. Use this for generated mutation combinations because it supports `mutations`, `maxCombinationSize`, `maxCandidates`, and `includeDefaultMutations`.
- `mutationsFile`, a backward-compatible shorthand for simple standalone `CandidateMutation` arrays. The CLI maps the array to `searchConfig.mutations` before calling core. Use `searchConfigFile` instead when you need bounds, caps, or default-mutation inclusion controls.
- `objectiveFile`, an objective config object for configurable scoring weights and penalties.

Relative paths in these fields resolve against `process.cwd()` at command execution time, not against the `--input-file` location. For repeatable scripts, run the command from a known working directory or use absolute paths.

If `fixturesFile` is omitted, the command uses bundled `benchmarkFixtures` from `@meta-harness/fixtures`. If `candidatesFile`, `searchConfigFile`, and `mutationsFile` are omitted, core uses the default single-mutation search behavior.

Use `candidatesFile` for a fixed candidate list. Use `searchConfigFile` for generated combinations, for example:

```json
{
  "mutations": [
    {
      "id": "prefer-verification-routing",
      "label": "Prefer verification routing",
      "section": "routing",
      "field": "taskTypeOrder",
      "value": ["verification", "fix", "codegen", "documentation", "planning", "analysis"]
    }
  ],
  "maxCombinationSize": 2,
  "maxCandidates": 7,
  "includeDefaultMutations": false
}
```

Do not provide both `mutationsFile` and `searchConfigFile`; the command fails rather than guessing which search config to use. The runnable example `input.json` uses `searchConfigFile` so generated combinations are configurable without editing the command.

The objective config supports these fields:

- `packetCompletenessWeight`
- `routeHitRateWeight`
- `verificationChecklistCoverageWeight`
- `expectedTagHitRateWeight`
- `selectedRecordPenalty`
- `selectedCommandPenalty`

## Human-readable output

Output includes the selected winner, train and held-out fixture counts, held-out score, and the selection file path:

```text
Candidate search run candidate-smoke
Winner: baseline (score 0.95)
Train fixtures: 1
Held-out fixtures: 1
Held-out score: 0.9
Selection: ./tmp/store/data/candidate-runs/candidate-smoke/selection.json
```

If malformed stored files are present, warning lines are printed before the summary.

## JSON output

Add `--json` to emit one payload:

```json
{
  "search": {"runId": "candidate-smoke"},
  "heldOut": {"candidateId": "baseline"},
  "warnings": [],
  "paths": {
    "selection": "./tmp/store/data/candidate-runs/candidate-smoke/selection.json"
  }
}
```

## Runtime outputs

The command writes reproducible local artifacts under `data/candidate-runs/<run-id>/`:

- `run.json`
- `selection.json`
- `candidates/<candidate-id>/candidate.json`
- `candidates/<candidate-id>/candidate.policy.ts`
- `candidates/<candidate-id>/search/summary.json`
- `candidates/<candidate-id>/search/fixtures/<fixture-id>.json`
- `candidates/<winner-id>/held-out/summary.json`
- `candidates/<winner-id>/held-out/fixtures/<fixture-id>.json`

## Notes

- Search evaluates only fixtures where `split === "train"`.
- Held-out fixtures are evaluated only for the already selected winner, so held-out data cannot steer winner selection.
- Held-out metrics are written separately and never change the selected winner.
- The command reads local memory/artifact stores under `--data-root`.
- `fixturesFile`, `candidatesFile`, `searchConfigFile`, `mutationsFile`, and `objectiveFile` are resolved relative to the current working directory.
- Use [`export-candidate-policy`](./export-candidate-policy.md) after review if you want a standalone policy artifact for the selected winner.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
