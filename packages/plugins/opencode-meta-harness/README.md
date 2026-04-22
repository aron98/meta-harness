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

Release automation now uses Changesets plus a manual commit-scoped `publish.yml` dispatch. Until the first package version is actually published, keep using the repo-checkout flow below; once a package version is live on npm, the install shape described here becomes the supported published-package path. See `../../../docs/releasing.md` for the repo release flow.

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

## Planned npm install flow

This package is not published to npm yet. After publish, the intended OpenCode config shape is:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@meta-harness/opencode-meta-harness"]
}
```

Put that in `opencode.json` or `~/.config/opencode/opencode.json` once a published package exists. Until then, prefer the repo-checkout file-based setup above.

## Troubleshooting

- `Cannot find module .../dist/index.js`: run `pnpm --filter @meta-harness/opencode-meta-harness build` again, then confirm the absolute path in your plugin file.
- Plugin changes are not showing up: restart OpenCode, because plugin files are loaded at startup.
- The plugin file loads but workspace imports fail: keep the re-export pointed at the built `dist/index.js` artifact, not `src/index.ts`.
- You need npm-only dependencies for a local plugin directory: OpenCode loads local plugin files directly; use a config-directory `package.json` for extra dependencies, or wait for the published npm package flow.

## What this package wires today

- `event` on `session.status` with `idle` -> best-effort shadow `endTask`
- `event` on `session.idle` -> compatibility fallback for the same `endTask`
- `experimental.session.compacting` -> best-effort shadow `compactSession`
- `tool.execute.before` on retrieval-like tool names -> best-effort heuristic `inspectRetrieval`

The package also currently derives task-start behavior from `chat.message`, but the public docs here intentionally avoid presenting that hook as a stable documented OpenCode contract.

For the retrieval hook specifically, the plugin uses the documented tool name field to gate the allowlist and only observes args as host payload context in this slice. It does not fabricate message ids, assistant authorship, or agent attribution, and it treats unsupported tool names as non-retrieval events.

## Architecture note

The adapter stays thin. Retrieval, routing, verification policy, and durable record schemas remain owned by `@meta-harness/core` and the shared seam in `@meta-harness/plugin-core`.
