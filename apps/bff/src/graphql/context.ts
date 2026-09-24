import type { Request } from "express";
import type { Logger } from "pino";
import { ApiClient } from "#clients/api-client";
import { logger } from "#common/logger/logger";
import { type Loaders, createLoaders } from "#graphql/loaders";

export interface GraphQLContext {
  /** Per-request logger (pino-http's `req.log`) — shares the request id with the access log line. */
  log: Logger;
  api: ApiClient;
  loaders: Loaders;
}

/** Built once per GraphQL request, so the ApiClient and loaders are request-scoped too. */
export function buildContext(req: Request): GraphQLContext {
  const log = req.log ?? logger;
  const requestId = String(req.id ?? "");
  const api = new ApiClient(requestId, log);
  const today = new Date().toISOString().slice(0, 10);

  return { log, api, loaders: createLoaders(api, today) };
}
