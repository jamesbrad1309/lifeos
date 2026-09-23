import pino from "pino";
import pinoHttp from "pino-http";

const isProd = process.env.NODE_ENV === "production";

/**
 * The one pino instance for the whole process — everything else (the Nest
 * logger adapter, the HTTP access-log middleware, the GraphQL operation
 * logger, per-service child loggers) wraps or derives from this, the same
 * way a Go service passes around one *zap.Logger (or its .Named() children)
 * instead of constructing loggers ad hoc.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, singleLine: true, translateTime: "HH:MM:ss" },
      },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
    censor: "[redacted]",
  },
});

/** A component-scoped child logger — e.g. `logger.child({ component: "HabitsService" })`. */
export function scopedLogger(component: string) {
  return logger.child({ component });
}

/**
 * Structured HTTP access logging for every request, including POST /graphql
 * (this is Express middleware, mounted before the GraphQL route in main.ts —
 * it has no idea GraphQL exists, it just logs method/url/status/duration).
 * Attaches a per-request child logger at `req.log`, which `graphql/context.ts`
 * reuses so GraphQL-layer logs share the same request id.
 */
export const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode}: ${err.message}`,
});
