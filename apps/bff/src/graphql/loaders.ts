import DataLoader from "dataloader";
import type { ApiClient } from "#clients/api-client";
import type { ApiHabitEntry, ApiHabitStats } from "#clients/api-types";

/**
 * Per-request DataLoaders. A habit list resolves `todayEntry` and several
 * stats fields for every habit. These loaders turn those N field calls into
 * one batched REST call each, instead of N HTTP round trips to the API.
 * They must be request-scoped: a shared loader would cache data across
 * unrelated requests.
 */
export interface Loaders {
  habitStats: DataLoader<string, ApiHabitStats>;
  todayEntry: DataLoader<string, ApiHabitEntry | null>;
}

function idsParam(ids: readonly string[]): string {
  return ids.map(encodeURIComponent).join(",");
}

export function createLoaders(api: ApiClient, today: string): Loaders {
  return {
    habitStats: new DataLoader(async (habitIds) => {
      const stats = await api.get<ApiHabitStats[]>(`/habits/stats?ids=${idsParam(habitIds)}`);
      const byId = new Map(stats.map((s) => [s.habitId, s]));
      return habitIds.map((id) => byId.get(id) ?? new Error(`No stats for habit ${id}`));
    }),

    todayEntry: new DataLoader(async (habitIds) => {
      const entries = await api.get<ApiHabitEntry[]>(
        `/habit-entries/by-date/${today}?habitIds=${idsParam(habitIds)}`,
      );
      const byHabitId = new Map(entries.map((entry) => [entry.habitId, entry]));
      return habitIds.map((id) => byHabitId.get(id) ?? null);
    }),
  };
}
