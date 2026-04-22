# `evaluate-packet`

Evaluate bundled benchmark fixtures against the current local store and compare retrieval-on and retrieval-off packet quality.

## Command

```bash
node apps/cli/dist/index.js evaluate-packet --data-root ./tmp/store
```

## Required flags

- `--data-root <path>`

## Human-readable output

Output starts with:

```text
Evaluated 5 benchmark packet(s)
```

The next line is the full evaluation JSON.

If malformed stored files are present, warning lines are printed before the summary line.

## JSON output

Add `--json` to emit `{ evaluation, warnings }`.

The `evaluation` object includes:

- `benchmarks`, one retrieval-on and retrieval-off comparison per bundled fixture
- `summary.benchmarkCount`
- `summary.retrievalOn`
- `summary.retrievalOff`
- `summary.comparison`

## Notes

- The command always uses the bundled `benchmarkFixtures` catalog from `@meta-harness/fixtures`.
- `referenceTime` comes from the command's current clock value when the evaluation runs.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Current architecture](../architecture/current-architecture.md)
- [Command index](./README.md)
