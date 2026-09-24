# GraphQL BFF (`apps/bff`)

A small **Express 5 + Apollo Server 4** service that serves the frontend's
GraphQL API. It contains **no business logic and has no database access**:
every resolver calls the internal REST API (`apps/api`) over HTTP. See
[overview.md](../architecture/overview.md) for where it sits.

## Layout

```
apps/bff/
├── scripts/copy-graphql-assets.mjs   # tsc doesn't copy .graphql files into dist/
└── src/
    ├── main.ts                       # Express app: access log, /health, Apollo at /graphql, graceful shutdown
    ├── common/
    │   ├── config/env.ts             # zod-validated env: BFF_PORT, API_URL, API_TIMEOUT_MS
    │   └── logger/logger.ts          # pino + pino-http (request id from x-request-id)
    ├── clients/
    │   ├── api-client.ts             # fetch wrapper: forwards request id, logs calls, maps errors
    │   └── api-types.ts              # JSON shapes of the API's responses (the network contract)
    └── graphql/
        ├── schema.ts                 # globs *.graphql + *.resolvers.js into one executable schema
        ├── context.ts                # per request: logger, ApiClient, DataLoaders
        ├── loaders.ts                # habitStats + todayEntry batch loaders
        ├── logging.plugin.ts         # one log line per GraphQL operation
        ├── root.schema.graphql / root.resolvers.ts   # Query/Mutation roots + JSON scalar
        ├── habits/                   # habits.schema.graphql + habits.resolvers.ts
        ├── habit-entries/
        ├── dashboard/
        └── journal/                  # journal entries + week summary, see domain/journal.md
```

A feature's SDL and resolvers live in the same folder. `schema.ts` globs
`**/*.graphql` and `**/*.resolvers.js`, so a new `graphql/<feature>/` folder
is picked up without editing a central registry.

## Resolvers only map GraphQL to REST

```ts
// graphql/habits/habits.resolvers.ts (excerpt)
Query: {
  habits: (_, __, ctx) => ctx.api.get<ApiHabit[]>("/habits"),
},
Mutation: {
  createHabit: (_, args, ctx) => ctx.api.post<ApiHabit>("/habits", args.input),
},
Habit: {
  todayEntry: (habit, _, ctx) => ctx.loaders.todayEntry.load(habit.id),
  currentStreak: async (habit, _, ctx) => (await ctx.loaders.habitStats.load(habit.id)).currentStreak,
},
```

Input validation (zod), streak and points formulas, and date handling all
live in the API. If a resolver starts making decisions, that logic belongs
in an API service instead.

## N+1 over HTTP: DataLoaders

A habit list with 20 habits resolves `todayEntry` 20 times and each stats
field 20 times. Without batching that's 100+ HTTP calls. `graphql/loaders.ts`
creates two loaders **per request** (in `buildContext`, never shared across
requests, or the cache would leak):

| Loader | Batched REST call |
| ------ | ----------------- |
| `habitStats` | `GET /habits/stats?ids=a,b,c` → streaks, points, level, heatmap per habit |
| `todayEntry` | `GET /habit-entries/by-date/YYYY-MM-DD?habitIds=a,b,c` |

All stats fields share one `habitStats` load, so asking for `currentStreak`,
`points` and `heatmap` still costs one call. A full dashboard query is
**3 API calls**, whatever the number of habits.

## The API client

`clients/api-client.ts` is created once per request with that request's
logger and id. For every call it:

- forwards **`x-request-id`**, so the API's access log uses the same id
- applies a timeout (`API_TIMEOUT_MS`, default 10s), so a hung API call
  can't hang the GraphQL request
- logs `method`, `path`, `status` and `durationMs` (`debug` on success,
  `warn` on 4xx, `error` on 5xx or connection failure)
- converts failures into GraphQL errors with a stable `extensions.code`:

| API response | GraphQL `extensions.code` | Message to client |
| ------------ | ------------------------- | ----------------- |
| 400 (zod validation) | `BAD_USER_INPUT` (+ `issues`: field paths and messages) | the API's message |
| 404 | `NOT_FOUND` | the API's message |
| 5xx / unexpected | `UPSTREAM_ERROR` | "Upstream API error" (internal details stay in logs) |
| connection refused / timeout | `UPSTREAM_UNAVAILABLE` | "The API is unavailable" |

## The API contract

`clients/api-types.ts` declares the JSON the BFF expects from each endpoint.
It's deliberately **not** imported from `apps/api`, because the BFF must not
depend on the API's Prisma types or build output. The REST endpoints are
listed in [nestjs-structure.md](nestjs-structure.md#rest-endpoints-consumed-by-the-bff).
If the API's response shape changes, update `api-types.ts` in the same PR.

## Running it

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` (root) | Web, BFF and API together |
| `pnpm dev:bff` | BFF only, with watch mode |
| `pnpm --filter bff build` | `tsc` + copy `.graphql` files into `dist/` |

Environment (from the root `.env` in dev, from `docker-compose.yml` in Docker):

| Variable | Default | |
| -------- | ------- | - |
| `BFF_PORT` | `4000` | |
| `API_URL` | `http://localhost:3000` | `http://api:3000` in Docker |
| `API_TIMEOUT_MS` | `10000` | Per API call |
| `LOG_LEVEL` | `debug` in dev, `info` in prod | Set it to `debug` to see every API call |

Introspection is enabled outside production only.

## Frontend contract

The client-facing schema is unchanged from when GraphQL lived in the API,
so `apps/web` needed no changes. Codegen for typed hooks should point at
`apps/bff`'s merged schema. See [frontend/stack.md](../frontend/stack.md#graphql-client).
