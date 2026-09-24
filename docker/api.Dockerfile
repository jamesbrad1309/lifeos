FROM node:22-slim AS base
# node:*-slim has no OpenSSL — Prisma's query engine binary needs it to load
# at all, and without it silently falls back to a possibly-mismatched build.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# 1. deps: only manifests (+ the Prisma schema, since api's own postinstall
#    runs `prisma generate` right after this install), so this layer is
#    cached until a dependency or the schema changes
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/bff/package.json apps/bff/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# 2. build: bring in source, compile, then produce a self-contained
#    prod-only deploy of just this package (pnpm's monorepo-aware prune)
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter api build
RUN pnpm --filter api --prod deploy --legacy /repo/pruned

# 3. runtime: nothing but the pruned output. `prisma migrate deploy` applies
#    any pending migrations before the app starts — safe to run on every
#    boot, it's a no-op once the schema is already up to date.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/pruned ./
# `pnpm --prod deploy` doesn't reliably carry over the generated Prisma
# client's engine/output (a postinstall side effect, not a tracked
# dependency) into the pruned tree — regenerate once against this image's
# own node_modules so it's guaranteed to exist here.
RUN ./node_modules/.bin/prisma generate
EXPOSE 3000
# `exec` makes node replace the shell as PID 1, so `docker compose stop`'s
# SIGTERM reaches the app (graceful shutdown) instead of being swallowed by
# sh until Docker gives up and SIGKILLs it (exit 137).
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
