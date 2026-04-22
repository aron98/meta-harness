# Releasing packages

This repo uses [Changesets](https://github.com/changesets/changesets) for independent package versioning across the published workspace packages.

## Published packages

- `@meta-harness/core`
- `@meta-harness/plugin-core`
- `@meta-harness/fixtures`
- `@meta-harness/cli`
- `@meta-harness/opencode-meta-harness`

## Contributor flow

1. In any feature PR that changes one or more published packages, add a changeset:

   ```bash
   pnpm changeset
   ```

2. Merge the feature PR to `main`.
3. Wait for `.github/workflows/release.yml` to open or update the `chore: version packages` release PR.
4. Review that PR carefully. It is the human check for version bumps, changelog text, and internal dependency updates.
5. Merge the version PR.
6. Let `release.yml` tag the versions created by that merge. Tagging now runs only when the `main` push both consumes a `.changeset/*.md` file and updates one of the published package manifests, which narrows it to the version-merge path instead of every no-changesets push.
7. Manually run `.github/workflows/publish.yml` with a `publish_ref` value that is either one of the newly created immutable package tags or the exact commit SHA from the merged version commit.
8. Approve the protected `npm-publish` environment when GitHub prompts for it.
9. Let `.github/workflows/publish.yml` publish every still-unpublished package version present at that exact commit.

## Tag format

Changesets tags packages with the default monorepo format:

- `@meta-harness/core@x.y.z`
- `@meta-harness/plugin-core@x.y.z`
- `@meta-harness/fixtures@x.y.z`
- `@meta-harness/cli@x.y.z`
- `@meta-harness/opencode-meta-harness@x.y.z`

## Why publish is manual

Publishing is intentionally gated by a manual workflow dispatch instead of a `push`, tag-triggered workflow, or GitHub Release abstraction:

- version bumps stay reviewable in a dedicated release PR
- package tags are created automatically after that PR merges
- publishing only happens when a human chooses an immutable package tag or exact commit SHA to publish from
- rerunning publish from the same tagged commit stays limited to the exact versions already cut there

## Recursion safety

`release.yml` pushes tags with the repository `GITHUB_TOKEN`. That is intentional:

- the bot-auth tag push should not trigger more workflows
- tag pushes are not the publish trigger in this repo
- the only publish trigger is a manual `workflow_dispatch` run of `publish.yml`

## Trusted publishing setup

The `publish.yml` workflow is designed for npm trusted publishing via GitHub Actions OIDC.

Configure this outside the repo before the first real publish:

1. In GitHub, create a protected environment named `npm-publish` and require reviewer approval.
2. In npm, configure trusted publishing for each public package with:
   - repository: `aron98/meta-harness`
   - workflow file: `publish.yml`
   - environment: `npm-publish`
3. Keep publishing on GitHub-hosted runners.

If the GitHub repository is private, trusted publishing still works, but npm provenance will not be emitted.
