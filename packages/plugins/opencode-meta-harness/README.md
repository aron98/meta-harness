# @meta-harness/opencode-meta-harness

Thin OpenCode adapter package for the current host-integration slice.

## Status in this slice

This package already ships a real default OpenCode plugin module with id `opencode-meta-harness`.

Today that module is verified for these host surfaces:

- the `event` hook for session idle transitions
- the `experimental.session.compacting` hook for best-effort compaction
- the documented `tool.execute.before` hook for heuristic retrieval-like inspection
- internal task-start wiring that is currently derived from `chat.message`

Treat `chat.message` as current implementation detail, not as a formally documented public OpenCode hook contract.

The retrieval integration in this slice is explicitly heuristic and observational. A small allowlist of retrieval-like tool names (`read`, `grep`, `glob`, and `webfetch`) triggers the existing adapter `inspectRetrieval()` seam from documented `tool.execute.before` inputs. In this slice, args are only observed in the host payload; they are not used for classification and are not interpreted as retrieval policy input. It does not introduce a first-class host retrieval contract, and it does not claim assistant-message or agent provenance that OpenCode does not expose in these hooks.

Release automation uses Changesets plus a manual commit-scoped `publish.yml` dispatch. See `../../../docs/releasing.md` for the repo release flow.

## Install from npm

Use the package executable to patch OpenCode config with the npm plugin tuple and a project-local data root:

```bash
npx @meta-harness/opencode-meta-harness install
```

By default this writes `.opencode/opencode.json` under the current working directory, creates `.opencode` if needed, and creates the project-local `.local/share/opencode-meta-harness` folder for plugin data. The installer resolves that folder to an absolute path before writing `dataRoot` into config, so the generated entry looks like:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [["@meta-harness/opencode-meta-harness", { "dataRoot": "/absolute/path/to/project/.local/share/opencode-meta-harness" }]]
}
```

For a user-level OpenCode install, pass `--global` or `-g`:

```bash
npx @meta-harness/opencode-meta-harness install --global
```

Global installs patch `$XDG_CONFIG_HOME/opencode/opencode.json` or `~/.config/opencode/opencode.json`, and create `$XDG_DATA_HOME/opencode-meta-harness` or `~/.local/share/opencode-meta-harness`.

Use `--dry-run` to print the target config and data paths without writing files.

## Install from a repo checkout

Use this flow when working from a local clone of this monorepo.

1. Build the package from the repo root:

   ```bash
   pnpm --filter @meta-harness/opencode-meta-harness build
   ```

2. Point an OpenCode plugin file at the built artifact:

   Project-local plugin file in `.opencode/plugins/meta-harness.js`:

   ```js
   export { default } from '/absolute/path/to/meta-harness/packages/plugins/opencode-meta-harness/dist/index.js'
   ```

   Global plugin file in `~/.config/opencode/plugins/meta-harness.js`:

   ```js
   export { default } from '/absolute/path/to/meta-harness/packages/plugins/opencode-meta-harness/dist/index.js'
   ```

3. Restart OpenCode so it reloads files from `.opencode/plugins/` or `~/.config/opencode/plugins/`.

OpenCode loads local plugin files directly from those directories at startup, so this setup is the truthful way to use the current unpublished package from a repo checkout.

## Troubleshooting

- `Cannot find module .../dist/index.js`: for repo-checkout installs, run `pnpm --filter @meta-harness/opencode-meta-harness build` again, then confirm the absolute path in your plugin file.
- `opencode-meta-harness install failed: Could not parse OpenCode config`: fix the JSON syntax in `opencode.json`; the installer does not overwrite invalid JSON.
- Plugin changes are not showing up: restart OpenCode, because plugin files are loaded at startup.
- The plugin file loads but workspace imports fail: keep the re-export pointed at the built `dist/index.js` artifact, not `src/index.ts`.
- You need npm-only dependencies for a local plugin directory: prefer the `npx @meta-harness/opencode-meta-harness install` flow so OpenCode resolves the published package from config.

## What this package wires today

- `event` on `session.status` with `idle` -> best-effort shadow `endTask`
- `event` on `session.idle` -> compatibility fallback for the same `endTask`
- `experimental.session.compacting` -> best-effort shadow `compactSession`
- `tool.execute.before` on retrieval-like tool names -> best-effort heuristic `inspectRetrieval`

The package also currently derives task-start behavior from `chat.message`, but the public docs here intentionally avoid presenting that hook as a stable documented OpenCode contract.

For the retrieval hook specifically, the plugin uses the documented tool name field to gate the allowlist and only observes args as host payload context in this slice. It does not fabricate message ids, assistant authorship, or agent attribution, and it treats unsupported tool names as non-retrieval events.

## Architecture note

The adapter stays thin. Retrieval, routing, verification policy, and durable record schemas remain owned by `@meta-harness/core` and the shared seam in `@meta-harness/plugin-core`.
