# Docker Setup

Two multi-stage Dockerfiles (one per app) plus `docker-compose.yml` for
local/dev orchestration (Postgres + both apps).

## Why multi-stage + pruning matters in a pnpm monorepo

A naive `COPY . .` + `pnpm install` in one Dockerfile stage means **any**
source change (including in the other app) invalidates the dependency-install
layer cache — full reinstall on every rebuild. Splitting into stages that
copy `package.json`s first, install, *then* copy source, keeps `pnpm install`
cached until a dependency actually changes. This pattern alone has been
reported to take images from ~1.8GB down to ~250MB in similar pnpm/Turborepo
setups.

## `docker/api.Dockerfile`

```dockerfile
FROM node:22-slim AS base
# node:*-slim has no OpenSSL — Prisma's query engine binary needs it to load
# at all, and without it silently falls back to a possibly-mismatched build.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# 1. deps: only manifests (+ the Prisma schema, since api's own postinstall
#    runs `prisma generate` right after this install), so this layer is
#    cached until a dependency or the schema changes.
#    pnpm's frozen-lockfile install fails if a workspace member listed in the
#    lockfile is missing from disk, so every app's package.json is copied
#    here even though this image only needs api's runtime.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# 2. build: bring in source, compile, then produce a self-contained
#    prod-only deploy of just this package (pnpm's monorepo-aware prune —
#    `--legacy` is required as of pnpm v10 when the package has no
#    workspace:* dependencies to inject)
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter api build
RUN pnpm --filter api --prod deploy --legacy /repo/pruned

# 3. runtime: nothing but the pruned output. `prisma migrate deploy` applies
#    any pending migrations before the app starts — safe to run on every
#    boot, it's a no-op once the schema is already up to date. `prisma`
#    (the CLI) is kept as a regular dependency, not a devDependency, so it
#    survives the prod-only deploy above and is actually available here.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/pruned ./
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
```

`docker/web.Dockerfile` follows the same deps → build shape, but its runtime
stage serves the static Vite build output instead of running Node:

```dockerfile
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/web apps/web
RUN pnpm --filter web build

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`apps/api/prisma` is copied here too, even though this image never runs the
api — a plain `pnpm install --frozen-lockfile` installs and runs lifecycle
scripts for every workspace project found in the build context, and api's
own `postinstall` (`prisma generate`) fails without its schema present, which
would fail this install too.

The frontend calls the relative path `/graphql` (see `apps/web/src/lib/apollo-client.ts`) — Vite's dev server proxies that to the api on `localhost:3000` (see `vite.config.ts`), but nginx needs the equivalent in production. `docker/nginx.conf` proxies `/graphql` to `http://api:3000/graphql` (the `api` hostname resolves via Docker Compose's internal network) and falls back to `/index.html` for client-side routing on every other path.

## `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: lifeos
      POSTGRES_USER: lifeos
      POSTGRES_PASSWORD: lifeos
    ports: ["5433:5432"] # host port only — the api container talks to "postgres:5432" internally
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lifeos"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    environment:
      DATABASE_URL: postgres://lifeos:lifeos@postgres:5432/lifeos
      API_PORT: "3000"
      NODE_ENV: production
    ports: ["3000:3000"]
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: docker/web.Dockerfile
    ports: ["8080:80"]
    depends_on: ["api"]

volumes:
  pgdata:
```

Postgres's host port is `5433`, not the default `5432` — pick whichever's actually free on the host (`lsof -nP -iTCP:5432 -sTCP:LISTEN`), since another local Postgres (e.g. one managed by OrbStack/Docker Desktop for a different project) commonly already holds `5432`. Only the host-side mapping matters here; containers still reach Postgres at `postgres:5432` on the internal Docker network regardless of the host port chosen.

## Scaling this up later

If build times become a real pain point as the monorepo grows, `turbo prune
--docker` (Turborepo) or `pnpm deploy` (pnpm's own equivalent — produces a
self-contained folder for one workspace package with hard-linked deps) are
the standard next steps for even tighter, more cacheable Docker layers. Not
needed yet for a two-app monorepo — the manual multi-stage split above is
enough.
