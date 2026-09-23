import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import type { Env } from "#common/config/env";
import { httpLogger, logger } from "#common/logger/logger";
import { NestPinoLogger } from "#common/logger/nest-logger.adapter";
import { buildContext } from "#graphql/context";
import { loggingPlugin } from "#graphql/logging.plugin";
import { executableSchema } from "#graphql/schema";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";
import { HabitsService } from "#habits/habits.service";
import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs holds Nest's own startup logs until useLogger below attaches
  // the pino-backed logger, so nothing gets lost or falls back to console.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(new NestPinoLogger());

  const config = app.get(ConfigService) as ConfigService<Env, true>;

  const habitsService = app.get(HabitsService);
  const habitEntriesService = app.get(HabitEntriesService);

  // Structured HTTP access logs for every request, including POST /graphql —
  // mounted before the /graphql route so it wraps it.
  app.use(httpLogger);

  const apollo = new ApolloServer({ schema: executableSchema, plugins: [loggingPlugin] });
  await apollo.start();

  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(apollo, {
      context: async ({ req }) => buildContext(req, { habitsService, habitEntriesService }),
    }),
  );

  const port = config.get("API_PORT", { infer: true });
  await app.listen(port);
  logger.info({ port }, "api listening");
}

bootstrap();
