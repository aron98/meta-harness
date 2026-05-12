# @meta-harness/opencode-meta-harness

Thin OpenCode adapter package for the current host-integration slice.

## Install for OpenCode

Use the package executable to patch the global OpenCode config with the npm plugin tuple and a user-level data root:

```bash
npx @meta-harness/opencode-meta-harness install
```

By default this writes `$XDG_CONFIG_HOME/opencode/opencode.json` or `~/.config/opencode/opencode.json`, and creates `$XDG_DATA_HOME/opencode-meta-harness` or `~/.local/share/opencode-meta-harness` for plugin data. The installer resolves that folder to an absolute path before writing `userDataRoot` into config, so the generated entry looks like:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [["@meta-harness/opencode-meta-harness", { "userDataRoot": "/home/you/.local/share/opencode-meta-harness" }]]
}
```

Use `--dry-run` to print the target config and data paths without writing files.

The installer is safe to run more than once. If the plugin is already configured, it normalizes duplicate bare entries into a single tuple and reports `Already installed: yes` instead of adding another plugin entry. If a newer npm version is available, the install output tells you to run the upgrade command.

The installer preserves existing tuple options, including policy options, but it does not add policy artifact paths for you. Runtime policy use is explicit configuration.

## Runtime policy and storage options

The OpenCode plugin tuple accepts these storage and policy options:

```json
[
  "@meta-harness/opencode-meta-harness",
  {
    "userDataRoot": "/home/you/.local/share/opencode-meta-harness",
    "userPolicyArtifactFile": "/home/you/.local/share/opencode-meta-harness/policies/user-policy.json",
    "dataRoot": "/repo/.meta-harness",
    "policyArtifactFile": "/repo/.meta-harness/policies/project-policy.json"
  }
]
```

- `dataRoot` is the optional project root when configured. Use it for shareable project-scoped records that should stay separate from user-local records.
- `policyArtifactFile` applies a project policy artifact. Project policy overrides user policy when both are configured.
- `userDataRoot` is the user root and is the fallback write root when no project data root is configured.
- `userPolicyArtifactFile` applies a user policy artifact when no project policy is configured.

`@meta-harness/plugin-core` can combine scoped project records first and scoped user records second when a host adapter supplies those record arrays. In this slice, the OpenCode plugin forwards scoped records through that adapter seam but does not perform filesystem-backed record reads from `dataRoot` or `userDataRoot` itself. `doctor` reports configured policy artifact paths and whether each artifact is present, missing, malformed, or not configured.

## Commands

```bash
npx @meta-harness/opencode-meta-harness install [--dry-run]
npx @meta-harness/opencode-meta-harness doctor
npx @meta-harness/opencode-meta-harness upgrade [--dry-run]
```

### `doctor`

`doctor` inspects the OpenCode config and package health without requiring OpenCode to be installed:

- OpenCode config path
- data root path
- whether the config exists and parses
- whether the plugin is configured
- the configured package spec
- whether the data root exists
- policy artifact path and status: `present`, `missing`, `malformed`, or `not configured`
- current package version
- latest npm version, or `unknown` if unavailable
- update status: `up to date`, `update available`, or `unknown`

### `upgrade`

OpenCode may cache npm plugin packages, so a bare package spec can remain on an older cached version. `upgrade` runs the same health checks as `doctor`; when a newer npm version is available, it rewrites the configured plugin package to an explicit version such as:

```json
{
  "plugin": [["@meta-harness/opencode-meta-harness@0.2.0", { "userDataRoot": "/home/you/.local/share/opencode-meta-harness" }]]
}
```

Tuple options such as `userDataRoot`, `dataRoot`, and policy artifact paths are preserved. If the config is already up to date, `upgrade` reports that no change is needed. Use `upgrade --dry-run` to preview the package spec change without writing the config.

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
- `opencode-meta-harness upgrade failed: Could not parse OpenCode config`: fix the JSON syntax in `opencode.json`; upgrade also refuses to overwrite invalid JSON.
- `doctor` shows `Latest npm version: unknown`: the npm registry check failed or was unavailable. The config checks are still useful; retry later before upgrading.
- Plugin changes are not showing up after npm publish: run `npx @meta-harness/opencode-meta-harness doctor`, then `npx @meta-harness/opencode-meta-harness upgrade` if it reports an update. This writes an explicit package version so OpenCode does not keep using a stale cached `@latest` resolution.
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
