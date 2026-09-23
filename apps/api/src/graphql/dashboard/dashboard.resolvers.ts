import type { Habit } from "@prisma/client";
import { type GraphQLContext, STATS_WINDOW_DAYS } from "#graphql/context";
import {
  computeLevel,
  computePoints,
  levelTitle,
  pointsRequiredForLevel,
} from "#habits/gamification.util";
import type { HabitSchedule } from "#habits/schedule.util";
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeTotalCompletions,
} from "#habits/streak.util";

async function statsForHabit(habit: Habit, ctx: GraphQLContext) {
  const entries = await ctx.entriesSinceLoader.load(habit.id);
  const schedule = habit.schedule as HabitSchedule;
  const today = new Date();

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
  return { currentStreak, longestStreak, points: computePoints(totalCompletions, currentStreak) };
}

export default {
  Query: {
    dashboardStats: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const habits = await ctx.habitsService.findAll();
      const perHabit = await Promise.all(habits.map((habit) => statsForHabit(habit, ctx)));

      const totalPoints = perHabit.reduce((sum, s) => sum + s.points, 0);
      const level = computeLevel(totalPoints);
      const longestOverallStreak = perHabit.reduce((max, s) => Math.max(max, s.longestStreak), 0);
      const activeStreakCount = perHabit.filter((s) => s.currentStreak > 0).length;

      return {
        totalHabits: habits.length,
        pausedHabits: habits.filter((h) => h.pausedAt != null).length,
        totalPoints,
        level,
        levelTitle: levelTitle(level),
        pointsIntoLevel: totalPoints - pointsRequiredForLevel(level),
        pointsForNextLevel: pointsRequiredForLevel(level + 1) - pointsRequiredForLevel(level),
        longestOverallStreak,
        activeStreakCount,
      };
    },
  },
};
