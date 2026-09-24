# lifeos — Habit Tracker: Architecture & Setup Docs

Research notes for building a habit tracker where users define **custom habits**
(arbitrary schedule, unit, target, extra fields) and track entries over time.

Stack: React + TypeScript + Vite + shadcn/ui (frontend) · NestJS + GraphQL as a
BFF (backend) · one pnpm workspace · native TypeScript `#` import aliases (no
alias plugin) · Biome + oxlint for linting/formatting · Docker + a one-command
quick start.

The app is `apps/web` (React + Vite), `apps/bff` (GraphQL BFF: Express +
Apollo) and `apps/api` (NestJS REST + Prisma), behind an nginx gateway in
Docker. These docs cover the design decisions and setup behind it.
Each file below is a short, standalone read.

## Map

**Architecture**
- [Monorepo layout](architecture/monorepo-layout.md) — pnpm workspace folder structure
- [System overview](architecture/overview.md) — how the pieces talk to each other

**Domain**
- [Use cases](domain/use-cases.md) — what the app needs to do, by lifecycle stage, with build status + impact score
- [Knowledge graph](domain/knowledge-graph.md) — how domain entities, use cases, backend, and frontend connect
- [Habit data model](domain/habit-data-model.md) — modeling "custom habit + arbitrary tracked info"
- [Journal](domain/journal.md) — actions, feelings and events; the `/slash` list syntax; linking feelings to events

**Finance** (planned module, not built yet)
- [Finance module overview](finance/index.md) — scope, build order, reading order
- [Finance use cases](finance/use-cases.md) — accounts, transactions, budgets, recurring bills, goals, reports
- [Account setup](finance/account-setup.md) — bank accounts, credit cards and limits, loans, IOUs, reconciling
- [Quick log](finance/quick-log.md) — logging an expense as an amount plus one tap
- [Quick log implementation](finance/quick-log-implementation.md) — API, category ranking, one-line parser, idempotency
- [Money handling](finance/money-handling.md) — integer minor units, currency, dates
- [Finance data model](finance/data-model.md) — Prisma models, derived balances, transfers
- [Finance backend module](finance/backend-module.md) — Nest module, DTOs, context wiring, DataLoaders
- [Finance GraphQL schema](finance/graphql-schema.md) — SDL sketch for the BFF's `graphql/finance/`
- [Budgets & reports](finance/budgets-and-reports.md) — budget vs actual, spend by category, cash flow
- [Recurring transactions & CSV import](finance/recurring-and-import.md) — lazy generation, dedupe
- [Finance frontend](finance/frontend.md) — components, money formatting, Apollo pagination, charts
- [Habits × finance integration](finance/habits-integration.md) — no-spend days, savings streaks, shared XP

**Frontend**
- [Frontend stack](frontend/stack.md) — Vite + React + TS baseline
- [shadcn/ui setup](frontend/shadcn-setup.md) — with native `#` aliases, not `@/*`
- [App shell](frontend/app-shell.md) — sidebar, app bar, hash-routed views, full-width page layouts

**Backend**
- [GraphQL BFF](backend/graphql-bff.md) — `apps/bff`: Express + Apollo, resolvers call the API over REST, DataLoaders, error mapping
- [API structure](backend/nestjs-structure.md) — `apps/api`: NestJS REST endpoints, where domain logic lives
- [Prisma & data access](backend/prisma-and-data-access.md) — schema, migrations, `PrismaService`, JSON/Date gotchas
- [Logging](backend/logging.md) — pino (Node's zap), HTTP/GraphQL/service-level logs, the `name` field gotcha

**Cross-cutting**
- [TypeScript `#` import aliases](shared/typescript-import-aliases.md) — the native alias mechanism, no plugin
- [Linting & formatting: Biome + oxlint](tooling/linting-formatting.md)
- [pnpm workspace config](tooling/pnpm-workspace.md)

**Infra**
- [Docker setup](infra/docker.md) — multi-stage builds for the monorepo
- [Quick start script](infra/quickstart.md) — one command to run everything
