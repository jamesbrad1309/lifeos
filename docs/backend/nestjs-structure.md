# Backend Structure: Standard Nest Modules + a Colocated GraphQL Server

`apps/api` is a NestJS app used for its module/DI/config conventions, not for
`@nestjs/graphql`. The rest of the backend follows standard Nest folder
conventions (one module per domain, with its own service/DTOs); **colocation
is scoped to the `graphql/` tree only** — that's the small Apollo Server
"application" mounted on Nest's Express instance, where each feature's SDL
and resolvers sit together. See [graphql-bff.md](graphql-bff.md) for why that
piece specifically is built this way.

## Folder layout

Two separate trees, on purpose: standard Nest module structure for
everything Nest owns (modules/services/DTOs), and colocation *only* inside
`graphql/` — that's the "GraphQL server application" living inside the Nest
app, not a convention applied to the whole backend. Database access goes
through Prisma, not per-module entity classes — see
[prisma-and-data-access.md](prisma-and-data-access.md).

```
apps/api/
├── prisma/
│   ├── schema.prisma               # single source of truth for the DB schema
│   └── migrations/
│
└── src/
    ├── main.ts                     # Nest bootstrap + mounts Apollo at /graphql
    │
    ├── graphql/                    # the colocated GraphQL server application
    │   ├── schema.ts                # merges all feature schemas + resolvers into one executable schema
    │   ├── context.ts               # builds per-request GraphQL context (req, services, loaders)
    │   ├── root.schema.graphql      # base Query/Mutation types + the JSON scalar
    │   ├── root.resolvers.ts
    │   ├── habits/
    │   │   ├── habits.schema.graphql  # SDL for this feature
    │   │   └── habits.resolvers.ts    # resolvers for the types/fields above, colocated with the SDL
    │   └── habit-entries/
    │       ├── habit-entries.schema.graphql
    │       └── habit-entries.resolvers.ts
    │
    ├── habits/                     # standard NestJS module (Nest CLI shape)
    │   ├── habits.module.ts
    │   ├── habits.service.ts        # talks to Prisma directly
    │   ├── schedule.util.ts
    │   └── dto/
    │       └── create-habit.dto.ts  # zod schema + inferred type
    ├── habit-entries/
    │   ├── habit-entries.module.ts
    │   ├── habit-entries.service.ts
    │   ├── habit-entries.loader.ts   # per-request DataLoader
    │   └── dto/
    │
    ├── common/
    │   ├── database/
    │   │   ├── prisma.service.ts    # PrismaClient wrapped as a Nest provider
    │   │   └── database.module.ts   # @Global() — exports PrismaService once
    │   └── config/                  # env validation (ConfigModule)
    └── app.module.ts                 # imports DatabaseModule, HabitsModule, HabitEntriesModule
```

- `graphql/<feature>/` is where colocation lives: a feature's SDL and its
  resolvers sit in the same folder so the GraphQL contract is readable in one
  place. Adding a habit-tracking feature (e.g. `streaks/`) here means adding
  one new folder under `graphql/`, not touching a shared `typeDefs/` and a
  shared `resolvers/` directory in lockstep.
- `habits/`, `habit-entries/`, etc. at the top level are ordinary Nest
  modules — providing injectable services and DTOs. They know nothing about
  GraphQL; resolvers import *from* them, not the other way around. There's no
  `entities/` folder — Prisma's generated types (from `prisma/schema.prisma`)
  are the entity types, imported as `import type { Habit } from "@prisma/client"`.

## Why keep NestJS at all, instead of pure Express

- `ConfigModule` + env validation (`@nestjs/config` + zod) for typed,
  validated environment variables.
- A conventional home for services/DI (`HabitsService` is just an
  `@Injectable()`, testable in isolation with Nest's testing module).
- A place to add REST endpoints later if needed (health checks, webhooks,
  file upload) without re-platforming.

## Wiring the resolvers to Nest's DI container

Because resolvers are plain functions (not `@Resolver()` classes), they need
explicit access to Nest-managed services. Build the GraphQL context per
request from the Nest `INestApplication` instance:

```ts
// main.ts (sketch)
const app = await NestFactory.create(AppModule);
const habitsService = app.get(HabitsService);

const apollo = new ApolloServer({ schema: executableSchema });
await apollo.start();

app.use(
  "/graphql",
  express.json(),
  expressMiddleware(apollo, {
    context: async ({ req }) => buildContext(req, { habitsService }),
  }),
);

await app.listen(3000);
```

`buildContext` (in `graphql/context.ts`) is the one place that turns
Nest-resolved singletons (from the `habits/`, `habit-entries/` modules) into
the `context` object every resolver under `graphql/` receives — see
[graphql-bff.md](graphql-bff.md) for the resolver side of this contract.

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
