# API Structure: NestJS REST Service (`apps/api`)

`apps/api` is a standard NestJS app: one module per domain, each with its
own controller, service and DTOs. It exposes an **internal REST API** that
only the GraphQL BFF (`apps/bff`) calls. It owns all business logic and all
database access (Prisma). GraphQL no longer lives here; see
[graphql-bff.md](graphql-bff.md) and [overview.md](../architecture/overview.md).

## Folder layout

```
apps/api/
├── prisma/
│   ├── schema.prisma               # single source of truth for the DB schema
│   └── migrations/
└── src/
    ├── main.ts                     # Nest bootstrap, pino logger, access-log middleware, shutdown hooks
    ├── app.module.ts               # ConfigModule, DatabaseModule, feature modules, HealthController
    ├── habits/
    │   ├── habits.module.ts         # imports HabitEntriesModule (stats need entries)
    │   ├── habits.controller.ts     # /habits REST routes
    │   ├── dashboard.controller.ts  # /dashboard/stats
    │   ├── habits.service.ts        # CRUD, talks to Prisma directly
    │   ├── habit-stats.service.ts   # streaks, points, level, heatmap, dashboard totals
    │   ├── schedule.util.ts / streak.util.ts / gamification.util.ts   # pure domain rules
    │   └── dto/                     # zod schemas + inferred types
    ├── habit-entries/
    │   ├── habit-entries.controller.ts
    │   ├── habit-entries.service.ts
    │   └── dto/
    ├── journal/                     # actions, feelings, events (see domain/journal.md)
    │   ├── journal.controller.ts    # /journal-entries REST routes
    │   ├── journal.service.ts       # per-kind column mapping, #tag parsing, atomic batch create
    │   └── dto/journal-entry.dto.ts # zod discriminated union on `kind`
    └── common/
        ├── config/env.ts            # zod env validation for ConfigModule
        ├── database/                # PrismaService + @Global() DatabaseModule
        ├── http/zod-validation.pipe.ts   # zod DTO → 400 with `issues`
        ├── health/health.controller.ts   # GET /health (checks the DB) for Docker
        └── logger/                  # pino, pino-http, Nest logger adapter
```

There's no `entities/` folder. Prisma's generated types are the entity types
(`import type { Habit } from "@prisma/client"`). See
[prisma-and-data-access.md](prisma-and-data-access.md).

## REST endpoints consumed by the BFF

Resource-shaped, not screen-shaped. Shaping data for screens is the BFF's
job.

| Method & path | Returns | Notes |
| ------------- | ------- | ----- |
| `GET /habits` | `Habit[]` (active) | `?archived=true` for archived habits |
| `GET /habits/today` | `Habit[]` due today | Excludes paused habits |
| `GET /habits/stats?ids=a,b` | `HabitStats[]` | **Batch** endpoint for the BFF's `habitStats` DataLoader |
| `GET /habits/:id` | `Habit` | 404 if missing |
| `POST /habits` | `Habit` | Body validated by `createHabitSchema` |
| `PATCH /habits/:id` | `Habit` | `updateHabitSchema` |
| `POST /habits/:id/archive` · `/unarchive` · `/pause` · `/resume` | `Habit` | |
| `GET /habits/:id/entries` | `HabitEntry[]` | Newest first |
| `GET /habit-entries/by-date/:date?habitIds=a,b` | `HabitEntry[]` | **Batch** endpoint for the `todayEntry` DataLoader |
| `PUT /habit-entries` | `HabitEntry` | Upsert on `(habitId, date)` |
| `GET /dashboard/stats` | Dashboard totals | |
| `GET /journal-entries?date=YYYY-MM-DD` | `JournalEntry[]` | One day, in time order, each with a trimmed `trigger` |
| `GET /journal-entries/days?from=&to=` | Per-day summaries | Counts per kind + emotions; at most 62 days |
| `POST /journal-entries` · `POST /journal-entries/batch` | `JournalEntry` · `JournalEntry[]` | Batch is one transaction; `triggerIndex` links to an earlier EVENT in the list |
| `PUT /journal-entries/:id` · `DELETE /journal-entries/:id` | `JournalEntry` · `{ id }` | PUT replaces the whole entry |
| `GET /health` | `{ status: "ok" }` | Runs `SELECT 1`; used by the Compose healthcheck |

Response conventions:

- **Dates** are ISO strings (JSON serialisation of `Date`). `HabitEntry.date`
  is sent as `"YYYY-MM-DD"` (`toEntryDto`), because it's a calendar day, not
  an instant.
- **Validation errors** are `400 { message: "Validation failed", issues: ZodIssue[] }`
  from `ZodValidationPipe`. The BFF forwards `issues` as a `BAD_USER_INPUT`
  GraphQL error.
- **Not found** is Nest's standard `404 { message }` from `NotFoundException`.
- **Graceful shutdown**: `main.ts` calls `app.enableShutdownHooks()`, so a
  SIGTERM (`docker compose stop`, redeploys) closes the HTTP server and runs
  `onModuleDestroy` (Prisma disconnects). Without it, Node running as PID 1
  in the container ignores SIGTERM and Docker SIGKILLs it after 10 s
  (exit 137).
- **Static routes come before `:id`** in `HabitsController`
  (`today` and `stats`), or Nest would treat `"stats"` as a habit id.

## Why NestJS for the API

- `ConfigModule` with zod-validated environment variables.
- DI for services, which keeps them testable in isolation with Nest's
  testing module.
- Controllers, pipes and exception filters give REST routing, validation
  and consistent error bodies with little code.

## Where domain logic lives

Streaks, points, levels and heatmaps are computed in `HabitStatsService`
from pure functions in `streak.util.ts` and `gamification.util.ts`. They were
previously computed in GraphQL resolvers and moved here when the BFF was
split out. The rule: **if it's a decision about the domain, it goes in the
API**. The BFF only fetches, batches and reshapes.

## Gotcha: don't let the linter turn injected services into type-only imports

Biome's `style/useImportType` rule (on by default) rewrites an import into
`import type { X } from "..."` whenever it only sees `X` used in a type
position — which is exactly how a constructor-injected service looks:

```ts
constructor(private readonly prisma: PrismaService) {}
```

NestJS resolves that parameter purely from `emitDecoratorMetadata`-generated
type info at runtime, which requires `PrismaService` to still exist as a real
**value** import — a type-only import erases before that metadata is
emitted, so Nest ends up trying to inject `Function`/`Object` and throws
`Nest can't resolve dependencies of the HabitsService (?)`. This isn't
theoretical: it happened during this project's own build the moment Biome's
auto-fixer touched `habits.service.ts`. `style/useImportType` is disabled
project-wide in `biome.json` for exactly this reason — every Nest-injected
class must be a normal (value) import, never `import type`.
