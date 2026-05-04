# `export-candidate-policy`

Export the selected winner from a candidate search run as a runtime policy artifact. The command reads candidate search artifacts and writes only the requested output file; it does not mutate OpenCode or user configuration.

## Command

```bash
node apps/cli/dist/index.js export-candidate-policy \
  --data-root ./tmp/store \
  --run-id candidate-smoke \
  --output-file ./tmp/store/winner-policy.json
```

## Required flags

- `--data-root <path>`
- `--run-id <id>`
- `--output-file <path>`

## Behavior

The command reads:

- `data/candidate-runs/<run-id>/selection.json`
- `data/candidate-runs/<run-id>/candidates/<candidate-id>/candidate.json`

It writes a JSON artifact to `--output-file`:

```json
{
  "runId": "candidate-smoke",
  "candidateId": "baseline",
  "policy": {
    "retrieval": {},
    "routing": {},
    "verification": {}
  }
}
```

The `policy` object is the selected candidate policy snapshot. The command is a safe export step only; applying the policy to any runtime or OpenCode configuration remains an explicit separate action.

Only the `--output-file` artifact is written. The command does not edit global OpenCode config, repo config, user config, plugin config, or candidate search inputs. Review the exported JSON before wiring it into any runtime.

## Human-readable output

```text
Exported candidate policy for run candidate-smoke
Winner: baseline
Output: ./tmp/store/winner-policy.json
```

## JSON output

Add `--json` to emit one payload:

```json
{
  "runId": "candidate-smoke",
  "candidateId": "baseline",
  "outputFile": "./tmp/store/winner-policy.json"
}
```

## Related docs

- [run-candidate-search](./run-candidate-search.md)
- [Candidate optimization examples](../examples/candidate-optimization/input.json)
- [Command index](./README.md)
