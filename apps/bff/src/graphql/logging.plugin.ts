import type { ApolloServerPlugin } from "@apollo/server";
import { logger } from "#common/logger/logger";
import type { GraphQLContext } from "#graphql/context";

const graphqlLogger = logger.child({ component: "graphql" });

/**
 * Per-operation structured logs — the GraphQL-layer equivalent of the HTTP
 * access log middleware (see common/logger/logger.ts). Reuses the
 * request's own child logger (attached to `req.log` by pino-http, threaded
 * through GraphQLContext) when available, so a slow or failing operation's
 * log line carries the same request id as its HTTP access log entry.
 */
export const loggingPlugin: ApolloServerPlugin<GraphQLContext> = {
  async requestDidStart({ request, contextValue }) {
    const start = Date.now();
    const log = contextValue?.log ?? graphqlLogger;
    const operationName = request.operationName ?? "anonymous";

    return {
      async didEncounterErrors({ errors }) {
        for (const error of errors) {
          const code = error.extensions?.code;
          // Client mistakes (bad input, missing ids) are expected traffic, so log them at warn.
          // Everything else is a real failure.
          const level = code === "BAD_USER_INPUT" || code === "NOT_FOUND" ? "warn" : "error";
          log[level](
            { operationName, code, err: { message: error.message, path: error.path } },
            "graphql operation failed",
          );
        }
      },

      async willSendResponse({ errors }) {
        if (errors?.length) return; // already logged in didEncounterErrors
        log.info({ operationName, durationMs: Date.now() - start }, "graphql operation completed");
      },
    };
  },
};
