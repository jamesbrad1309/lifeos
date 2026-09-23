# lifeos — Habit Tracker: Architecture & Setup Docs

Research notes for building a habit tracker where users define **custom habits**
(arbitrary schedule, unit, target, extra fields) and track entries over time.

Stack: React + TypeScript + Vite + shadcn/ui (frontend) · NestJS + GraphQL as a
BFF (backend) · one pnpm workspace · native TypeScript `#` import aliases (no
alias plugin) · Biome + oxlint for linting/formatting · Docker + a one-command
quick start.

This is a planning/reference doc set only — no application code has been
written yet. Each file below is a short, standalone read.

## Map

**Architecture**
- [Monorepo layout](architecture/monorepo-layout.md) — pnpm workspace folder structure
- [System overview](architecture/overview.md) — how the pieces talk to each other

**Domain**
- [Use cases](domain/use-cases.md) — what the app needs to do, by lifecycle stage, with build status + impact score
- [Knowledge graph](domain/knowledge-graph.md) — how domain entities, use cases, backend, and frontend connect
- [Habit data model](domain/habit-data-model.md) — modeling "custom habit + arbitrary tracked info"

**Frontend**
- [Frontend stack](frontend/stack.md) — Vite + React + TS baseline
- [shadcn/ui setup](frontend/shadcn-setup.md) — with native `#` aliases, not `@/*`

**Backend**
- [NestJS structure](backend/nestjs-structure.md) — Nest as host, colocated GraphQL feature folders
- [GraphQL BFF layer](backend/graphql-bff.md) — small Express/Apollo server, schema colocated per feature
- [Prisma & data access](backend/prisma-and-data-access.md) — schema, migrations, `PrismaService`, JSON/Date gotchas
- [Logging](backend/logging.md) — pino (Node's zap), HTTP/GraphQL/service-level logs, the `name` field gotcha

**Cross-cutting**
- [TypeScript `#` import aliases](shared/typescript-import-aliases.md) — the native alias mechanism, no plugin
- [Linting & formatting: Biome + oxlint](tooling/linting-formatting.md)
- [pnpm workspace config](tooling/pnpm-workspace.md)

**Infra**
- [Docker setup](infra/docker.md) — multi-stage builds for the monorepo
- [Quick start script](infra/quickstart.md) — one command to run everything
