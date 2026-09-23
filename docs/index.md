# lifeos — Habit Tracker: Architecture & Setup Docs

Research notes for building a habit tracker where users define **custom habits**
(arbitrary schedule, unit, target, extra fields) and track entries over time.

Stack: React + TypeScript + Vite + shadcn/ui (frontend) · NestJS + GraphQL as a
BFF (backend) · one pnpm workspace · native TypeScript `#` import aliases (no
alias plugin) · Biome + oxlint for linting/formatting · Docker + a one-command
quick start.

The app lives in `apps/api` (NestJS + GraphQL + Prisma) and `apps/web`
(React + Vite). These docs cover the design decisions and setup behind it.
Each file below is a short, standalone read.

## Map

**Architecture**
- [Monorepo layout](architecture/monorepo-layout.md) — pnpm workspace folder structure
- [System overview](architecture/overview.md) — how the pieces talk to each other

**Domain**
- [Use cases](domain/use-cases.md) — what the app needs to do, by lifecycle stage, with build status + impact score
- [Knowledge graph](domain/knowledge-graph.md) — how domain entities, use cases, backend, and frontend connect
- [Habit data model](domain/habit-data-model.md) — modeling "custom habit + arbitrary tracked info"

**Finance** (planned module, not built yet)
- [Finance module overview](finance/index.md) — scope, build order, reading order
- [Finance use cases](finance/use-cases.md) — accounts, transactions, budgets, recurring bills, goals, reports
- [Money handling](finance/money-handling.md) — integer minor units, currency, dates
- [Finance data model](finance/data-model.md) — Prisma models, derived balances, transfers
- [Finance backend module](finance/backend-module.md) — Nest module, DTOs, context wiring, DataLoaders
- [Finance GraphQL schema](finance/graphql-schema.md) — SDL sketch for `graphql/finance/`
- [Budgets & reports](finance/budgets-and-reports.md) — budget vs actual, spend by category, cash flow
- [Recurring transactions & CSV import](finance/recurring-and-import.md) — lazy generation, dedupe
- [Finance frontend](finance/frontend.md) — components, money formatting, Apollo pagination, charts
- [Habits × finance integration](finance/habits-integration.md) — no-spend days, savings streaks, shared XP

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
