# Logging: pino (the zap of Node)

Go's `zap` is fast, structured (key/value fields, not string-interpolated
messages), and leveled. **pino** is the closest Node equivalent — same
philosophy, consistently one of the fastest JSON loggers in the ecosystem —
so it's what `apps/api` and `apps/bff` use everywhere, instead of
`console.log` or Nest's default text logger. The nginx gateway writes JSON
access logs in the same style.

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

## One request id across gateway → BFF → API

```
gateway   {"service":"gateway","reqId":"86e2…","uri":"/graphql","status":200,"durationMs":0.031}
bff       {"service":"bff","req":{"id":"86e2…"},"msg":"graphql operation completed","durationMs":25}
api       {"req":{"id":"86e2…"},"msg":"GET /dashboard/stats 200","responseTime":15}
```

1. The **gateway** keeps the client's `X-Request-Id` or generates one
   (`$request_id`), logs it as `reqId`, and forwards it to the BFF.
2. The **BFF**'s `pino-http` uses that header as the request id
   (`genReqId`). Its access log, GraphQL operation log and API-client logs
   all go through that request's child logger (`req.log`).
3. The BFF's `ApiClient` forwards `x-request-id` on every REST call.
4. The **API**'s `pino-http` uses it the same way.

Filter on one id to see everything a user action did:
`docker compose logs gateway bff api | grep <id>`. The id is also returned
in the `X-Request-Id` response header, so it can be copied from the browser's
network tab.

When a service is called without the header (for example `curl` straight to
the API in local dev), it generates its own id.

## Layers of logging

**BFF (`apps/bff`)**

1. **HTTP access log** (`httpLogger`, `pino-http`): one line per request,
   mounted before `/graphql`. `/health` is excluded to avoid healthcheck noise.
2. **GraphQL operation log** (`graphql/logging.plugin.ts`): one line per
   operation with `operationName` and `durationMs`. Errors are logged with
   their `extensions.code`: `warn` for client mistakes (`BAD_USER_INPUT`,
   `NOT_FOUND`), `error` for everything else.
3. **API-client log** (`clients/api-client.ts`): every REST call with
   `method`, `path`, `status` and `durationMs`. Successful calls log at
   `debug` (set `LOG_LEVEL=debug` to see them), 4xx at `warn`, and 5xx or
   connection failures at `error`.

**API (`apps/api`)**

1. **HTTP access log**: one line per REST call from the BFF.
2. **Service-level business events**: `HabitsService` and
   `HabitEntriesService` each hold a `scopedLogger("...")` and log the
   *writes* that matter (`habit created`, `habit archived`, `habit entry
   upserted`). Reads aren't logged, because the access logs already cover them.

Every BFF line carries `"service":"bff"` (the logger's `base` field), so
mixed logs can be filtered by service.

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
