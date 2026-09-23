import type { LoggerService } from "@nestjs/common";
import { logger } from "#common/logger/logger";

/**
 * Routes Nest's own framework logs (module init, route mapping, etc.)
 * through the same pino instance as everything else, so output is uniformly
 * structured JSON in production instead of Nest's default colored text.
 */
export class NestPinoLogger implements LoggerService {
  log(message: unknown, context?: string) {
    logger.info({ context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string) {
    logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string) {
    logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string) {
    logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string) {
    logger.trace({ context }, String(message));
  }
}
