import { createServer } from "node:http";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import { env } from "#common/config/env";
import { httpLogger, logger } from "#common/logger/logger";
import { type GraphQLContext, buildContext } from "#graphql/context";
import { loggingPlugin } from "#graphql/logging.plugin";
import { executableSchema } from "#graphql/schema";

/**
 * The GraphQL BFF: a small Express app that hosts Apollo Server and is the
 * only thing the browser talks to (through the gateway). It holds no
 * business logic and has no database access. Every resolver calls apps/api
 * over REST (see clients/api-client.ts).
 */
async function bootstrap() {
  const app = express();
  app.disable("x-powered-by");

  // Access log for every request. Mounted first so it wraps /graphql, and it
  // attaches req.log / req.id, which the GraphQL context reuses.
  app.use(httpLogger);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);

  const apollo = new ApolloServer<GraphQLContext>({
    schema: executableSchema,
    introspection: env.NODE_ENV !== "production",
    plugins: [loggingPlugin, ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await apollo.start();

  app.use(
    "/graphql",
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, { context: async ({ req }) => buildContext(req) }),
  );

  // Listen only once /graphql is mounted, so nothing gets a 404 during startup.
  httpServer.listen(env.BFF_PORT, () => {
    logger.info({ port: env.BFF_PORT, apiUrl: env.API_URL }, "bff listening");
  });

  // Docker sends SIGTERM on `docker compose down`/redeploys. Let in-flight
  // GraphQL requests finish (the drain plugin) before exiting.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
      logger.info({ signal }, "bff shutting down");
      await apollo.stop();
      process.exit(0);
    });
  }
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "bff failed to start");
  process.exit(1);
});
