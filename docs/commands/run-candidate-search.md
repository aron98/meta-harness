# `run-candidate-search`

Evaluate bounded candidate policies against bundled benchmark fixtures, select one winner on the train split, and validate that winner on held-out fixtures.

## Command

```bash
node apps/cli/dist/index.js run-candidate-search --data-root ./tmp/store --input-file ./tmp/store/candidate-run.json
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
  "maxArtifacts": 2
}
```

`referenceTime`, `maxMemories`, and `maxArtifacts` are optional. If `referenceTime` is omitted, the command uses the current clock time.

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
- Held-out fixtures are evaluated only for the already selected winner.
- Held-out metrics are written separately and never change the selected winner.
- The command uses bundled `benchmarkFixtures` from `@meta-harness/fixtures` and local memory/artifact stores under `--data-root`.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
