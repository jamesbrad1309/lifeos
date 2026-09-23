# System Overview

```
┌────────────────────┐         GraphQL (HTTP)         ┌──────────────────────────────┐
│  apps/web           │  ────────────────────────────▶ │  apps/api (NestJS)           │
│  React + Vite + TS  │ ◀────────────────────────────  │  Express platform underneath │
│  shadcn/ui           │        single /graphql          │  ┌─────────────────────┐   │
└────────────────────┘                                 │  │ Apollo Server        │   │
                                                         │  │ mounted at /graphql  │   │
                                                         │  │ schema colocated     │   │
                                                         │  │ per feature folder   │   │
                                                         │  └─────────────────────┘   │
                                                         │  Nest modules/services for  │
                                                         │  business logic + DI        │
                                                         │  Postgres via Prisma         │
                                                         └──────────────┬───────────────┘
                                                                        │
                                                                 ┌──────▼──────┐
                                                                 │  Postgres    │
                                                                 └─────────────┘
```

`apps/api` is a NestJS app (`@nestjs/platform-express`), but the GraphQL
layer itself deliberately bypasses `@nestjs/graphql`'s decorator-based
code-first module. Instead it's a small, plain `@apollo/server` instance
mounted onto Nest's underlying Express instance via `expressMiddleware` at
`/graphql`. Each feature's schema (`.graphql` SDL) and resolvers are
colocated in the same folder and merged into one executable schema at
startup — Nest still provides module/service structure and DI for the
business logic underneath the resolvers. See
[nestjs-structure.md](../backend/nestjs-structure.md) and
[graphql-bff.md](../backend/graphql-bff.md) for the exact layout and the
reasoning for skipping `@nestjs/graphql`.

## Why GraphQL as a BFF here, specifically

A BFF (Backend-for-Frontend) exists to shape data around what one frontend
needs instead of exposing a generic REST resource model. For a single-page
habit tracker with one frontend, the practical benefits are:

- One `/graphql` endpoint instead of hand-rolled REST routes per screen
  (habit list with today's status, calendar heatmap data, streak stats) —
  the frontend asks for exactly the shape it needs in one round trip.
- Strong typing end-to-end: colocated SDL schema → GraphQL Code Generator →
  typed Apollo/urql hooks in React, so a habit schema change is a compile
  error in the frontend, not a runtime surprise.
- Room to grow: if this later adds a mobile app or an automation/import
  service behind the same API, the GraphQL layer is already the aggregation
  point rather than a REST controller that needs re-shaping per client.

If this project only ever has one frontend and simple CRUD, a plain REST
controller would also work — GraphQL is the more future-proof choice here
because "track all the information of my habits" implies flexible, evolving
query shapes (custom fields, filters, aggregates) which GraphQL handles more
gracefully than versioned REST endpoints.

## Request flow example: loading today's habits

1. `apps/web` sends a `todayHabits` query to `apps/api`'s `/graphql`.
2. The colocated `habits` resolver (`Query.todayHabits` in
   `habits/habits.resolvers.ts`) calls into `HabitsService`, a plain Nest
   injectable resolved from Nest's DI container.
3. Service queries Postgres for the user's habits + today's entries.
4. Resolver returns a typed `HabitWithTodayStatus[]` shape — already merged,
   so the frontend doesn't do two fetches and join client-side.

See [graphql-bff.md](../backend/graphql-bff.md) for the schema shape and
[habit-data-model.md](../domain/habit-data-model.md) for the underlying data.
