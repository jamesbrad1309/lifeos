# System Overview

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │ docker compose (internal network)                            │
  browser        │                                                              │
 ──────────▶ :8080  gateway (nginx) ──/graphql──▶ bff (Express + Apollo) ──REST──▶ api (NestJS) ──▶ postgres
                 │        │                        :4000                    :3000      Prisma      :5432
                 │        └──── /* ───────────────▶ web (nginx, static SPA)                         │
                 └──────────────────────────────────────────────────────────────┘
```

Four application containers, each doing one job:

| Service | App | Job | Reachable from |
| ------- | --- | --- | -------------- |
| **gateway** | nginx (`docker/gateway.nginx.conf`) | Single public entry point: routing, request ids, access log, rate limit on `/graphql` | Host `:8080` |
| **web** | `apps/web` | Serves the built React SPA as static files | gateway only |
| **bff** | `apps/bff` | GraphQL for the frontend: shapes, batches and aggregates data. **No business logic, no DB access** | gateway only |
| **api** | `apps/api` | REST API with all domain logic (validation, streaks, points) and all database access via Prisma | bff only |

In local dev there's no gateway. Vite's dev server proxies `/graphql` to the
BFF on `localhost:4000` (`apps/web/vite.config.ts`), and the BFF calls the API
on `localhost:3000`.

## Why a separate BFF service

GraphQL used to be mounted inside the Nest process, with resolvers calling
Nest services directly. It's now split out so that:

- **The API is a plain, resource-shaped REST service.** Other clients (a
  future mobile app, import jobs, the finance module's automations) can use
  it without going through a frontend-specific GraphQL schema.
- **The frontend's contract can change without touching domain code.**
  Adding a field that combines two API calls is a BFF-only change.
- **Each process has one job and one failure mode.** The BFF has no
  database connection pool, and the API has no GraphQL runtime.

The cost is an extra network hop. The BFF limits it with request-scoped
**DataLoaders**: a habit list asking for stats and today's entry makes
**3 REST calls total** (list + one batched stats call + one batched entries
call), however many habits there are. See [graphql-bff.md](../backend/graphql-bff.md).

## Request flow example: loading the dashboard

1. The browser POSTs `{ habits { name currentStreak todayEntry { completed } } }`
   to `/graphql`.
2. The **gateway** assigns a request id (or keeps the client's
   `X-Request-Id`), logs the request, and proxies it to `bff:4000`.
3. The **BFF** resolves `Query.habits` → `GET /habits` on the API. Each
   habit's `currentStreak` and `todayEntry` are queued in DataLoaders and
   sent as **one** `GET /habits/stats?ids=…` and **one**
   `GET /habit-entries/by-date/2026-09-24?habitIds=…`.
4. The **API** validates, queries Postgres through Prisma, computes streaks
   and points (`HabitStatsService`), and returns JSON.
5. The BFF assembles the GraphQL response. Every hop logs the same request
   id, so one user action can be traced across all three services (see
   [logging.md](../backend/logging.md)).

## Why GraphQL for the frontend

A single-page app with one frontend could use REST directly. GraphQL earns
its place here because:

- **One round trip per screen.** The dashboard needs habits, today's
  entries, stats and the summary header; the BFF fetches them in parallel
  and returns exactly the requested fields.
- **The schema is the frontend contract.** Colocated SDL in `apps/bff` can
  generate typed hooks for `apps/web`.
- **Room to grow.** Finance screens combine accounts, balances and budgets.
  That aggregation belongs in the BFF, not in the browser or the domain API.

See [graphql-bff.md](../backend/graphql-bff.md) for the BFF,
[nestjs-structure.md](../backend/nestjs-structure.md) for the API, and
[docker.md](../infra/docker.md) for the containers.
