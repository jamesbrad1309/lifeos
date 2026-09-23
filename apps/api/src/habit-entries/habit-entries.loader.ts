import type { HabitEntry } from "@prisma/client";
import DataLoader from "dataloader";
import type { HabitEntriesService } from "#habit-entries/habit-entries.service";

/**
 * One loader per GraphQL request (see graphql/context.ts) — batches the N
 * "todayEntry" field-resolver calls from a habit list into a single query,
 * and must not be a singleton or its cache would leak across requests.
 */
export function createTodayEntryLoader(
  service: HabitEntriesService,
  today: string,
): DataLoader<string, HabitEntry | null> {
  return new DataLoader<string, HabitEntry | null>(async (habitIds) => {
    const entries = await service.findForHabitsOnDate(habitIds, today);
    const byHabitId = new Map(entries.map((entry) => [entry.habitId, entry]));
    return habitIds.map((id) => byHabitId.get(id) ?? null);
  });
}

/**
 * Batches the per-habit "give me your last N days of entries" calls used
 * for streaks/points/heatmap into one query — same request-scoping rule as
 * the loader above.
 */
export function createEntriesSinceLoader(
  service: HabitEntriesService,
  since: Date,
): DataLoader<string, HabitEntry[]> {
  return new DataLoader<string, HabitEntry[]>(async (habitIds) => {
    const entries = await service.findForHabitsSince(habitIds, since);
    const byHabitId = new Map<string, HabitEntry[]>();
    for (const entry of entries) {
      const list = byHabitId.get(entry.habitId);
      if (list) list.push(entry);
      else byHabitId.set(entry.habitId, [entry]);
    }
    return habitIds.map((id) => byHabitId.get(id) ?? []);
  });
}
