import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Env } from "#common/config/env";
import { httpLogger, logger } from "#common/logger/logger";
import { NestPinoLogger } from "#common/logger/nest-logger.adapter";
import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs holds Nest's own startup logs until useLogger below attaches
  // the pino-backed logger, so nothing gets lost or falls back to console.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(new NestPinoLogger());

  const config = app.get(ConfigService) as ConfigService<Env, true>;

  // Structured HTTP access logs for every REST call from the BFF. Reuses the
  // BFF's x-request-id so one user action can be followed across both
  // services' logs (see common/logger/logger.ts).
  app.use(httpLogger);

  // On SIGTERM/SIGINT (`docker compose stop`, redeploys) close the HTTP
  // server and run onModuleDestroy (PrismaService disconnects) instead of
  // being SIGKILLed after Docker's 10 s grace period. Needed in Docker in
  // particular: as PID 1, node gets no default signal handling at all.
  app.enableShutdownHooks();

  const port = config.get("API_PORT", { infer: true });
  await app.listen(port);
  logger.info({ port }, "api listening");
}

bootstrap();
