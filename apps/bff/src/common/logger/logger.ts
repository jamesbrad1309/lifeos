import { randomUUID } from "node:crypto";
import pino from "pino";
import pinoHttp from "pino-http";

const isProd = process.env.NODE_ENV === "production";

/**
 * The one pino instance for the BFF process — same setup as apps/api's
 * logger, so both services' output looks and parses the same.
 */
export const logger = pino({
  base: { service: "bff" },
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

/** A component-scoped child logger — e.g. `scopedLogger("api-client")`. */
export function scopedLogger(component: string) {
  return logger.child({ component });
}

/**
 * HTTP access log for every request (POST /graphql, GET /health). The
 * request id comes from the gateway's `x-request-id` when present, and is
 * forwarded to the API by the ApiClient. That shared id ties together the
 * gateway, BFF and API log lines for one user action.
 */
export const httpLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" },
  genReqId: (req, res) => {
    const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode}: ${err.message}`,
});
