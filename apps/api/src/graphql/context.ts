import type { HabitEntry } from "@prisma/client";
import type DataLoader from "dataloader";
import type { Request } from "express";
import type { Logger } from "pino";
import { logger } from "#common/logger/logger";
import {
  createEntriesSinceLoader,
  createTodayEntryLoader,
} from "#habit-entries/habit-entries.loader";
import type { HabitEntriesService } from "#habit-entries/habit-entries.service";
import type { HabitsService } from "#habits/habits.service";

type RequestWithLog = Request & { log?: Logger };

/**
 * How far back streaks/points/heatmaps look. A longer window makes
 * "longest streak" and the heatmap more meaningful but costs one extra row
 * scan per request — 120 days (~4 months) is a reasonable trade-off for a
 * personal habit tracker; see docs/domain/use-cases.md.
 */
export const STATS_WINDOW_DAYS = 120;

export interface GraphQLContext {
  req: RequestWithLog;
  /** Per-request logger (pino-http's `req.log`, see common/logger/logger.ts) — shares a request id with that request's HTTP access log line. */
  log: Logger;
  habitsService: HabitsService;
  habitEntriesService: HabitEntriesService;
  todayEntryLoader: DataLoader<string, HabitEntry | null>;
  entriesSinceLoader: DataLoader<string, HabitEntry[]>;
}

export interface ContextDeps {
  habitsService: HabitsService;
  habitEntriesService: HabitEntriesService;
}

/**
 * Built once per GraphQL request. The DataLoaders in particular must be
 * request-scoped — a singleton loader would leak cached rows across
 * unrelated requests.
 */
export function buildContext(req: RequestWithLog, deps: ContextDeps): GraphQLContext {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date();
  since.setDate(since.getDate() - STATS_WINDOW_DAYS);

  return {
    req,
    log: req.log ?? logger,
    habitsService: deps.habitsService,
    habitEntriesService: deps.habitEntriesService,
    todayEntryLoader: createTodayEntryLoader(deps.habitEntriesService, today),
    entriesSinceLoader: createEntriesSinceLoader(deps.habitEntriesService, since),
  };
}
