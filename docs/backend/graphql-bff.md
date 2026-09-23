# GraphQL BFF Layer: Colocated Schema on a Small Express/Apollo Server

## Why not `@nestjs/graphql`

`@nestjs/graphql`'s code-first mode generates the schema from decorated
TypeScript classes (`@ObjectType()`, `@Field()`, `@Resolver()`), spread across
files the framework wires together via its module system. That's a
reasonable default, but this project instead wants:

- **Schema colocation**: a feature's SDL (`.graphql` file) sits next to its
  resolver file, both readable together, instead of the schema being an
  emergent side-effect of decorators scattered across classes.
- **A minimal GraphQL runtime**: `@apollo/server` mounted as Express
  middleware is a few lines, with no Nest-specific GraphQL abstraction to
  learn on top of plain Apollo Server concepts (useful if this ever needs to
  swap in `graphql-yoga` or move the GraphQL layer out of Nest entirely).

Nest is still the host process (bootstrap, DI, config) — see
[nestjs-structure.md](nestjs-structure.md). Only the GraphQL wiring itself
skips Nest's GraphQL module.

## Packages

```bash
pnpm --filter api add @apollo/server graphql @graphql-tools/schema @graphql-tools/merge
```

- `@apollo/server` — the GraphQL server itself (v4/v5; framework-agnostic).
- `graphql` — peer dependency, the reference GraphQL.js implementation.
- `@graphql-tools/schema` — `makeExecutableSchema` to turn merged SDL +
  resolvers into one executable schema.
- `@graphql-tools/merge` — merges an array of colocated typeDefs/resolvers
  into one before calling `makeExecutableSchema`.

## Colocated feature schema example

```graphql
# apps/api/src/graphql/habits/habits.schema.graphql
type Habit {
  id: ID!
  name: String!
  unit: String
  targetValue: Float
  schedule: HabitSchedule!
  todayEntry: HabitEntry
}

type Query {
  habits: [Habit!]!
  todayHabits: [Habit!]!
}

input CreateHabitInput {
  name: String!
  unit: String
  targetValue: Float
  schedule: HabitScheduleInput!
}

type Mutation {
  createHabit(input: CreateHabitInput!): Habit!
}
```

```ts
// apps/api/src/graphql/habits/habits.resolvers.ts
import type { GraphQLContext } from "../context";

export const habitsResolvers = {
  Query: {
    habits: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.habitsService.findAll(ctx.userId),
    todayHabits: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.habitsService.findDueToday(ctx.userId),
  },
  Mutation: {
    createHabit: (_: unknown, args: { input: CreateHabitInput }, ctx: GraphQLContext) =>
      ctx.habitsService.create(ctx.userId, args.input),
  },
  Habit: {
    // field resolver: fetches today's entry lazily per habit, not eagerly for every query
    todayEntry: (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      ctx.habitEntriesLoader.load(habit.id),
  },
};
```

## Merging colocated schemas into one executable schema

```ts
// apps/api/src/graphql/schema.ts
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";

const typeDefs = mergeTypeDefs(loadFilesSync(`${__dirname}/**/*.schema.graphql`));
const resolvers = mergeResolvers(loadFilesSync(`${__dirname}/**/*.resolvers.{ts,js}`));

export const executableSchema = makeExecutableSchema({ typeDefs, resolvers });
```

`loadFilesSync` with a glob scoped to `graphql/**` means adding
`graphql/streaks/streaks.schema.graphql` + `graphql/streaks/streaks.resolvers.ts`
is picked up automatically — no central registry file to edit per feature,
and the glob never reaches into the plain Nest module folders (`habits/`,
`habit-entries/`) sitting next to `graphql/`.

## N+1 avoidance

Field resolvers (like `Habit.todayEntry` above) run once per parent object,
so a naive per-habit DB query becomes N+1 queries for a habit list. Use
`dataloader` (batches + caches per-request) for any field resolver that
fetches related data — construct one `HabitEntriesLoader` per request inside
`buildContext`, not as a singleton, so caching doesn't leak across users.

## Frontend contract

Run `graphql-codegen` against `apps/api`'s merged schema (introspection or a
generated `.graphql` SDL file) to produce typed hooks for `apps/web` — see
[frontend/stack.md](../frontend/stack.md#graphql-client).
