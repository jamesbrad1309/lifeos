import DataLoader from "dataloader";
import type { ApiClient } from "#clients/api-client";
import type {
  ApiAccount,
  ApiAccountMetrics,
  ApiCategory,
  ApiHabitEntry,
  ApiHabitStats,
} from "#clients/api-types";

/**
 * Per-request DataLoaders. A habit list resolves `todayEntry` and several
 * stats fields for every habit, an account list a balance and derived
 * card/loan values for every account. These loaders turn those N field calls into
 * one batched REST call each, instead of N HTTP round trips to the API.
 * They must be request-scoped: a shared loader would cache data across
 * unrelated requests.
 */
export interface Loaders {
  habitStats: DataLoader<string, ApiHabitStats>;
  todayEntry: DataLoader<string, ApiHabitEntry | null>;
  accountMetrics: DataLoader<string, ApiAccountMetrics>;
  /** A transaction list resolves `account` and `category` per row; these batch them. */
  accountById: DataLoader<string, ApiAccount>;
  categoryById: DataLoader<string, ApiCategory>;
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

    accountMetrics: new DataLoader(async (accountIds) => {
      const metrics = await api.get<ApiAccountMetrics[]>(
        `/accounts/balances?ids=${idsParam(accountIds)}&today=${today}`,
      );
      const byId = new Map(metrics.map((m) => [m.accountId, m]));
      return accountIds.map((id) => byId.get(id) ?? new Error(`No balance for account ${id}`));
    }),

    accountById: new DataLoader(async (ids) => {
      const accounts = await api.get<ApiAccount[]>(`/accounts?ids=${idsParam(ids)}`);
      const byId = new Map(accounts.map((a) => [a.id, a]));
      return ids.map((id) => byId.get(id) ?? new Error(`No account ${id}`));
    }),

    categoryById: new DataLoader(async (ids) => {
      const categories = await api.get<ApiCategory[]>(`/categories?ids=${idsParam(ids)}`);
      const byId = new Map(categories.map((c) => [c.id, c]));
      return ids.map((id) => byId.get(id) ?? new Error(`No category ${id}`));
    }),
  };
}
