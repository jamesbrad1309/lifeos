# Prisma & Data Access

`apps/api` uses Prisma (not TypeORM) as the only data-access layer. One
schema file is the source of truth; there are no per-module entity classes —
see [nestjs-structure.md](nestjs-structure.md) for how that changes the
folder layout.

## Schema

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Habit {
  id          String    @id @default(uuid())
  name        String
  unit        String?
  targetValue Float?
  schedule    Json
  metadata    Json      @default("{}")
  archivedAt  DateTime?
  entries     HabitEntry[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("habits")
}
```

- `targetValue`/`value` are `Float`, not Prisma's `Decimal` — `Decimal` maps
  to a `Decimal.js` object in JS (not a plain `number`), which is more
  precision than a personal habit tracker needs and would force `.toNumber()`
  conversions at every GraphQL boundary.
- `@@map("habits")` keeps the plural, snake_case table name instead of
  Prisma's default (the model name verbatim, `Habit`).
- `id String @default(uuid())` stores a client-generated UUID in a plain
  `TEXT` column — simpler than a native Postgres `uuid` column + server-side
  default, and just as adequate here.

## `PrismaService`: the one place `PrismaClient` is instantiated

```ts
// apps/api/src/common/database/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`DatabaseModule` marks itself `@Global()` and exports `PrismaService`, so
`HabitsService`/`HabitEntriesService` just take it as a constructor
parameter — no per-module `TypeOrmModule.forFeature([...])`-style wiring
needed.

## Migrations

Two different commands for two different situations:

- **`pnpm --filter api migrate:dev`** — local development. Diffs
  `schema.prisma` against the dev database, writes a new
  `prisma/migrations/<timestamp>_<name>/migration.sql`, and applies it
  immediately. Wrapped with `dotenv-cli` (`dotenv -e ../../.env -- prisma
  migrate dev`) because Prisma's CLI looks for `.env` next to
  `schema.prisma` or in the CLI's own cwd — neither of which is this
  project's root `.env`.
- **`prisma migrate deploy`** — production. Applies whatever migrations
  already exist in `prisma/migrations/`; never generates new ones, never
  prompts. This runs automatically as part of the container's start command
  (see [docker.md](../infra/docker.md)) — safe to run on every boot, it's a
  no-op once the schema is current.

Never run `migrate dev` against a production database — it can drop and
recreate columns to resolve a diff it can't express as a safe migration.

## Two Prisma-specific type gotchas hit while building this

1. **`Json` fields need an explicit cast when writing.** A zod-inferred type
   like `Record<string, unknown>` doesn't structurally satisfy Prisma's
   `Prisma.InputJsonValue` (an `unknown` value isn't provably JSON), so
   writes need `as Prisma.InputJsonValue`:

   ```ts
   this.prisma.habit.create({
     data: { ...input, metadata: (input.metadata ?? {}) as Prisma.InputJsonValue },
   });
   ```

2. **`DateTime` fields come back as real `Date` objects**, same as they did
   under TypeORM. When GraphQL lived in the API, this hit a GraphQL `String`
   scalar coercion bug: `String.serialize` calls `isFinite(value)`, which is
   `true` for a bare `Date` (via its numeric epoch coercion), silently
   turning the date into a millisecond-timestamp string instead of an ISO
   one. Now the API returns JSON, and `JSON.stringify` turns a `Date` into an
   ISO string, so the BFF only ever sees strings. The remaining rule: send
   **date-only** columns (`@db.Date`, like `HabitEntry.date`) as
   `"YYYY-MM-DD"` explicitly (`toEntryDto` in `habit-entries.controller.ts`).
   Otherwise they arrive as `"2026-09-24T00:00:00.000Z"`, a UTC-midnight
   instant that is a day off in negative-offset time zones.

## Hand-written indexes must be declared in the schema

`prisma migrate dev` diffs the database against `schema.prisma` and
"fixes" anything it doesn't know about. A unique index created by hand in a
migration (because Prisma can't express it, e.g. `NULLS NOT DISTINCT`) is
seen as drift and **dropped in the next generated migration**. This happened
to `monthly_totals_key` in `add_budgets`, and every transaction write failed
until `restore_monthly_totals_key` put it back.

- Declare the index in the schema under the same name, e.g.
  `@@unique([month, accountId, categoryId], map: "monthly_totals_key")`.
  Prisma then treats it as expected; the parts it can't express
  (`NULLS NOT DISTINCT`) stay in the hand-written SQL.
- Partial indexes (`… WHERE …`) aren't affected: Prisma ignores them.
- **Read the generated migration before applying it.** Check for `DROP`s you
  didn't ask for:
  `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  should print "empty migration" when the schema and database agree.
- Services that depend on such an index can check it on startup
  (`MonthlyTotalsService.onModuleInit`), so a lost index stops the API
  instead of failing every write.
