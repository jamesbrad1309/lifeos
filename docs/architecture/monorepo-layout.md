# Monorepo Layout

One pnpm workspace holding the frontend, the GraphQL BFF, the NestJS REST
API, and any code shared between them. See [overview.md](overview.md) for
how they talk to each other.

```
lifeos/
├── apps/
│   ├── web/                 # React + Vite + TS + shadcn/ui
│   ├── bff/                 # Express + Apollo Server: GraphQL for the frontend
│   └── api/                 # NestJS REST API + Prisma: domain logic, DB access
├── packages/
│   ├── graphql-schema/      # shared generated types/operations (optional, see below)
│   └── config/              # shared tsconfig/biome base configs
├── docker/
│   ├── web.Dockerfile + web.nginx.conf
│   ├── bff.Dockerfile
│   ├── api.Dockerfile
│   └── gateway.nginx.conf    # client gateway: the only public entry point
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json              # root scripts + devDependencies (biome, oxlint, typescript)
├── biome.json
├── .oxlintrc.json
└── scripts/
    └── quickstart.sh
```

## Why `apps/` + `packages/`

- `apps/*` — deployable units (have their own Dockerfile, their own `imports`
  aliasing, get their own `pnpm --filter <app> dev`).
- `packages/*` — internal libraries consumed by more than one app. Only add a
  package here when something is *actually* shared (e.g. the GraphQL codegen
  output used by both `web` and tests). Don't pre-create empty shared packages.

## Cross-package imports vs. intra-app aliases

These are two different mechanisms and it's easy to conflate them:

- **Within an app** (e.g. inside `apps/web`), use the native `#` subpath
  imports described in [typescript-import-aliases.md](../shared/typescript-import-aliases.md).
  These are private to that package and never cross a package boundary.
- **Between packages** (e.g. `apps/api` importing `packages/graphql-schema`),
  use a normal package-name import (`@lifeos/graphql-schema`) resolved by
  pnpm's workspace linking (`workspace:*` in `package.json`). This is regular
  Node module resolution, not aliasing.

## Naming

Use a scope for internal packages, e.g. `@lifeos/*`, so an import like
`@lifeos/graphql-schema` is unambiguous — it's a workspace, not a real npm
package. Set `"private": true` on every `package.json` so nothing is
accidentally published.
