# Logging: pino (the zap of Node)

Go's `zap` is fast, structured (key/value fields, not string-interpolated
messages), and leveled. **pino** is the closest Node equivalent — same
philosophy, consistently one of the fastest JSON loggers in the ecosystem —
so it's what `apps/api` uses everywhere, instead of `console.log` or Nest's
default text logger.

## One shared instance, like a package-level `*zap.Logger`

```ts
// apps/api/src/common/logger/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true } },
  redact: { paths: ["req.headers.authorization", "*.password", "*.token"], censor: "[redacted]" },
});

export function scopedLogger(component: string) {
  return logger.child({ component });
}
```

- **Dev**: `pino-pretty` renders colorized, human-readable single-line output.
- **Prod**: plain structured JSON (no `transport`) — cheap to produce, easy
  for any log aggregator to parse. Toggle verbosity with `LOG_LEVEL` (trace
  through fatal) without a redeploy.
- `scopedLogger("HabitsService")` is the `zap.Logger.Named(...)` /
  `logger.With(zap.String("component", ...))` equivalent — every log line
  from that logger carries `"component":"HabitsService"` automatically.

## Three layers of logging

1. **HTTP access logs** (`httpLogger`, built with `pino-http`) — mounted as
   Express middleware in `main.ts` *before* the `/graphql` route, so every
   request (including GraphQL POSTs) gets a structured line: method, url,
   status, response time, and a request id. It has no idea GraphQL exists —
   it's the same access-log layer any REST endpoint would get for free.
2. **GraphQL operation logs** (`graphql/logging.plugin.ts`) — an Apollo
   Server plugin logging one line per operation: `operationName`,
   `durationMs`, and (via `didEncounterErrors`) any resolver errors. It reuses
   the *same* per-request child logger `pino-http` already attached to
   `req.log` (threaded through `GraphQLContext.log` in `graphql/context.ts`),
   so a GraphQL operation's log line shares a request id with its HTTP access
   log line — the two can be correlated.
3. **Service-level business-event logs** — `HabitsService`/
   `HabitEntriesService` each hold a `scopedLogger("...")` and log the
   *writes* that matter (`habit created`, `habit archived`, `habit entry
   upserted`), not every read — reads are already covered by the HTTP/GraphQL
   layers above and would just be noise.

## Nest's own framework logs go through pino too

```ts
// main.ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
app.useLogger(new NestPinoLogger());
```

`NestPinoLogger` (`common/logger/nest-logger.adapter.ts`) implements Nest's
`LoggerService` interface and forwards every call to the shared `logger`, so
"Nest application successfully started" and friends come out as the same
structured JSON as everything else — one log format for the whole process,
not Nest's colored text plus pino's JSON side by side. `bufferLogs: true`
holds Nest's very-early startup logs until `useLogger` attaches, so nothing
before that point falls back to `console`.

## A real gotcha hit while wiring this up: `name` is reserved

```ts
// wrong — collides with pino's own reserved "name" field (the logger's name,
// shown in pino-pretty's "(name/pid)" prefix), silently mislabeling the line
log.info({ habitId: habit.id, name: habit.name }, "habit created");

// right
log.info({ habitId: habit.id, habitName: habit.name }, "habit created");
```

This happened for real during development — a habit named "Log test habit"
made pino-pretty print `(Log test habit/32769)` as the process label instead
of showing `habitName` as a normal field. Avoid `name` (and other pino
reserved keys — `level`, `time`, `msg`, `pid`, `hostname`) as your own field
names in a log call.
