# Docker Setup

Three multi-stage Dockerfiles (api, bff, web), an nginx **gateway**, and
`docker-compose.yml` to run everything:

```
browser → :8080 gateway ─┬─ /graphql → bff:4000 → api:3000 → postgres:5432
                         └─ /*       → web:80 (static SPA)
```

```bash
docker compose up --build        # then open http://localhost:8080
```

Only the **gateway** (`:8080`) and **Postgres** (`:5433`, for local tools
like Prisma Studio) are published to the host. `api` and `bff` use `expose`,
not `ports`, so they're reachable only on the internal Compose network. The
browser can't bypass the BFF, and nothing outside Docker can call the API.

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
COPY apps/bff/package.json apps/bff/package.json
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
RUN ./node_modules/.bin/prisma generate
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
```

`exec` makes Node replace the shell as PID 1, so `docker compose stop`'s
SIGTERM reaches the app instead of being swallowed by `sh`. The app also has
to *handle* it (`app.enableShutdownHooks()` in the API, a SIGTERM handler in
the BFF), because PID 1 gets no default signal handling. Otherwise Docker
waits 10 s and SIGKILLs the container, which shows up as exit code **137**.

`docker/bff.Dockerfile` has the same deps → build → prune shape. Its runtime
stage is plain `node:22-slim` **without OpenSSL or Prisma**, because the BFF
never touches the database. It runs `node dist/main.js` on port 4000.

`docker/web.Dockerfile` has the same deps → build shape, but its runtime
stage is nginx serving the static Vite build (`docker/web.nginx.conf`). That
config only serves files: hashed `/assets/*` are cached for a year,
`index.html` is `no-cache`, and unknown paths fall back to `index.html` for
client-side routes. **It knows nothing about `/graphql`.** Routing is the
gateway's job.

Every Dockerfile's deps stage copies **all** workspace `package.json` files
(api, bff, web) plus `apps/api/prisma`. `pnpm install --frozen-lockfile`
checks the whole workspace against the lockfile, and api's `postinstall`
(`prisma generate`) needs its schema. Adding a new app means adding its
`package.json` line to every Dockerfile.

## The gateway (`docker/gateway.nginx.conf`)

Stock `nginx:1.27-alpine` with the config mounted read-only. There's no
custom image to build. It:

| Does | How |
| ---- | --- |
| Routes `/graphql` → `bff:4000` and everything else → `web:80` | `upstream` blocks; keepalive connections to the BFF |
| Assigns a **request id** | Keeps the client's `X-Request-Id` or generates `$request_id`; forwards it upstream and returns it in the response |
| Writes a **JSON access log** | `reqId`, status, duration, upstream time, the same field style as the pino logs |
| **Rate-limits** `/graphql` | 20 req/s per IP with a burst of 40; returns 429 |
| Basic hardening | 1 MB body limit, gzip, `nosniff`, `Referrer-Policy` |
| Health | `GET /healthz`, answered by nginx itself |

## Startup order and healthchecks

`depends_on` with `condition: service_healthy` starts things in order:
**postgres → api → bff → gateway**.

- `api` checks `GET /health`, which runs `SELECT 1` against Postgres.
- `bff` checks `GET /health`.
- `node:22-slim` has no `curl`, so both healthchecks use Node's built-in
  `fetch` (`node -e "fetch(...)"`).
- The API runs `prisma migrate deploy` on every start, before listening,
  and that's a no-op when the schema is up to date. The healthcheck's
  `start_period` allows time for it.

## Following one request across containers

```bash
curl -s localhost:8080/graphql -H 'content-type: application/json' \
  -H 'x-request-id: trace-me' -d '{"query":"{ habits { name currentStreak } }"}'
docker compose logs gateway bff api | grep trace-me
```

This prints the gateway access line, the BFF access and operation lines,
and one API access line per REST call, all with `trace-me`. See
[logging.md](../backend/logging.md).

## Common pitfalls

- **`docker compose up` doesn't rebuild.** If an image already exists,
  Compose reuses it, and new code never reaches the containers. Use
  `docker compose up --build` after changing code.
- **502 on `localhost:5173`.** That's the Vite dev server, not Docker. It
  proxies `/graphql` to `localhost:4000`, which isn't published when the BFF
  runs in Docker. Open `http://localhost:8080` instead, or point the dev
  server at the gateway: `BFF_URL=http://localhost:8080 pnpm dev:web`.

## Postgres host port

Postgres's host port is `5433`, not the default `5432` — pick whichever's actually free on the host (`lsof -nP -iTCP:5432 -sTCP:LISTEN`), since another local Postgres (e.g. one managed by OrbStack/Docker Desktop for a different project) commonly already holds `5432`. Only the host-side mapping matters here; containers still reach Postgres at `postgres:5432` on the internal Docker network regardless of the host port chosen.

## Scaling this up later

If build times become a real pain point as the monorepo grows, `turbo prune
--docker` (Turborepo) or `pnpm deploy` (pnpm's own equivalent — produces a
self-contained folder for one workspace package with hard-linked deps) are
the standard next steps for even tighter, more cacheable Docker layers. Not
needed yet at three apps. The manual multi-stage split above is enough.
