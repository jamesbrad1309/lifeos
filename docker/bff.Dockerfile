FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# 1. deps: only workspace manifests, so this layer stays cached until a
#    dependency changes. Every app's package.json is copied because
#    `--frozen-lockfile` checks the whole workspace against pnpm-lock.yaml.
#    The Prisma schema is here only because api's postinstall runs `prisma generate`.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/bff/package.json apps/bff/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# 2. build, then a self-contained prod-only copy of just this package
FROM deps AS build
COPY apps/bff apps/bff
RUN pnpm --filter bff build
RUN pnpm --filter bff --prod deploy --legacy /repo/pruned

# 3. runtime: compiled JS + prod node_modules only. No database access,
#    so unlike api.Dockerfile it needs no OpenSSL or Prisma.
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/pruned ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
