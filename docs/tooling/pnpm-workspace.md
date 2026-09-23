# pnpm Workspace Config

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Root `package.json`

```json
{
  "name": "lifeos",
  "private": true,
  "packageManager": "pnpm@9.x",
  "scripts": {
    "dev": "pnpm --parallel --filter ./apps/* dev",
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api dev",
    "build": "pnpm --filter ./apps/* build",
    "lint": "oxlint . && biome lint .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@biomejs/biome": "^1.x",
    "oxlint": "^0.x"
  }
}
```

Keep TypeScript, Biome, and oxlint as **root** devDependencies shared by
every workspace package — one version across the monorepo avoids
per-package drift and duplicate installs.

## Running commands against one app

```bash
pnpm --filter web add react-hook-form
pnpm --filter api add @apollo/server
pnpm --filter web dev
```

`--filter <name>` matches the `name` field in that package's `package.json`
(e.g. `web`, `api`), not the folder name, though keeping them identical
avoids confusion.

## Shared dependency versions: catalogs

For dependencies used by more than one workspace package (e.g. `graphql`
needed by both `apps/api` and `packages/graphql-schema`), pin the version
once via pnpm's `catalog` feature instead of repeating a version string in
multiple `package.json` files:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  graphql: ^16.9.0
  typescript: ^5.6.0
```

```json
// apps/api/package.json
{
  "dependencies": {
    "graphql": "catalog:"
  }
}
```

Bumping `graphql` for the whole monorepo is then a one-line change in
`pnpm-workspace.yaml`.

## Cross-package (workspace) dependencies

```json
// apps/web/package.json
{
  "dependencies": {
    "@lifeos/graphql-schema": "workspace:*"
  }
}
```

`workspace:*` is rewritten to a real semver range only if the package is
ever published; locally pnpm symlinks it straight to `packages/graphql-schema`.
