# `build-fixture-artifacts`

Generate the fixture schemas and fixture markdown artifacts under `docs/generated`.

## Command

```bash
node apps/cli/dist/index.js build-fixture-artifacts
```

## Required flags

None.

## What it writes

The command calls `buildFixtureArtifacts()` in `apps/cli/src/build-fixture-artifacts.ts`, which currently writes:

- `docs/generated/schemas/fixture-authoring.schema.json`
- `docs/generated/schemas/canonical-fixture.schema.json`
- one `docs/generated/fixtures/<fixture-id>.json` file per bundled fixture
- one `docs/generated/fixtures/<fixture-id>.md` file per bundled fixture
- `docs/generated/fixtures/index.md`

## Human-readable output

```text
Wrote files:
- schemas/fixture-authoring.schema.json
- schemas/canonical-fixture.schema.json
- fixtures/<fixture-id>.json
- fixtures/<fixture-id>.md
- fixtures/index.md
```

## Notes

- This command does not take `--input`, `--input-file`, or `--json`.
- Output paths are relative to the command's internal `docs/generated` output root.

## Related docs

- [Usage guide](../usage/mvp-usage.md)
- [Command index](./README.md)
