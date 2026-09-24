import { Injectable } from "@nestjs/common";
import type { Habit, HabitEntry } from "@prisma/client";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";
import {
  computeLevel,
  computePoints,
  levelTitle,
  pointsRequiredForLevel,
} from "#habits/gamification.util";
import { HabitsService } from "#habits/habits.service";
import type { HabitSchedule } from "#habits/schedule.util";
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeTotalCompletions,
} from "#habits/streak.util";

/**
 * How far back streaks/points/heatmaps look. A longer window makes
 * "longest streak" and the heatmap more meaningful but costs a bigger row
 * scan per request — 120 days (~4 months) is a reasonable trade-off for a
 * personal habit tracker; see docs/domain/use-cases.md.
 */
export const STATS_WINDOW_DAYS = 120;

export interface HeatmapDay {
  date: string;
  completed: boolean;
  value: number | null;
}

export interface HabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  points: number;
  level: number;
  levelTitle: string;
  /** One entry per day in the stats window, oldest first. */
  heatmap: HeatmapDay[];
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Derived per-habit and dashboard stats. These used to be computed inside
 * GraphQL field resolvers; they live here now so the domain rules stay in
 * the API and the BFF only shapes and batches data (see
 * docs/backend/graphql-bff.md).
 */
@Injectable()
export class HabitStatsService {
  constructor(
    private readonly habitsService: HabitsService,
    private readonly habitEntriesService: HabitEntriesService,
  ) {}

  /** Stats for many habits with one entries query — the BFF batches field requests into this. */
  async statsFor(habitIds: readonly string[]): Promise<HabitStats[]> {
    const habits = await this.habitsService.findManyByIds(habitIds);
    const since = new Date();
    since.setDate(since.getDate() - STATS_WINDOW_DAYS);
    const entries = await this.habitEntriesService.findForHabitsSince(habitIds, since);

    const entriesByHabit = new Map<string, HabitEntry[]>();
    for (const entry of entries) {
      const list = entriesByHabit.get(entry.habitId);
      if (list) list.push(entry);
      else entriesByHabit.set(entry.habitId, [entry]);
    }

    const today = new Date();
    return habits.map((habit) =>
      this.computeStats(habit, entriesByHabit.get(habit.id) ?? [], today),
    );
  }

  async dashboardStats() {
    const habits = await this.habitsService.findAll();
    const perHabit = await this.statsFor(habits.map((habit) => habit.id));

    const totalPoints = perHabit.reduce((sum, s) => sum + s.points, 0);
    const level = computeLevel(totalPoints);

    return {
      totalHabits: habits.length,
      pausedHabits: habits.filter((h) => h.pausedAt != null).length,
      totalPoints,
      level,
      levelTitle: levelTitle(level),
      pointsIntoLevel: totalPoints - pointsRequiredForLevel(level),
      pointsForNextLevel: pointsRequiredForLevel(level + 1) - pointsRequiredForLevel(level),
      longestOverallStreak: perHabit.reduce((max, s) => Math.max(max, s.longestStreak), 0),
      activeStreakCount: perHabit.filter((s) => s.currentStreak > 0).length,
    };
  }

  private computeStats(habit: Habit, entries: HabitEntry[], today: Date): HabitStats {
    const schedule = habit.schedule as HabitSchedule;
    const currentStreak = computeCurrentStreak(
      schedule,
      entries,
      habit.targetValue,
      today,
      STATS_WINDOW_DAYS,
    );
    const longestStreak = computeLongestStreak(
      schedule,
      entries,
      habit.targetValue,
      today,
      STATS_WINDOW_DAYS,
    );
    const totalCompletions = computeTotalCompletions(entries, habit.targetValue);
    const points = computePoints(totalCompletions, currentStreak);
    const level = computeLevel(points);

    const byDate = new Map(entries.map((entry) => [dateKey(entry.date), entry]));
    const heatmap: HeatmapDay[] = [];
    for (let offset = STATS_WINDOW_DAYS - 1; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - offset);
      const key = dateKey(date);
      const entry = byDate.get(key);
      heatmap.push({
        date: key,
        completed: entry?.completed ?? false,
        value: entry?.value ?? null,
      });
    }

    return {
      habitId: habit.id,
      currentStreak,
      longestStreak,
      totalCompletions,
      points,
      level,
      levelTitle: levelTitle(level),
      heatmap,
    };
  }
}
