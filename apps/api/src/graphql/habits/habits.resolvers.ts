import type { Habit, HabitEntry } from "@prisma/client";
import { type GraphQLContext, STATS_WINDOW_DAYS } from "#graphql/context";
import { createHabitSchema } from "#habits/dto/create-habit.dto";
import { updateHabitSchema } from "#habits/dto/update-habit.dto";
import { computeLevel, computePoints, levelTitle } from "#habits/gamification.util";
import type { HabitSchedule } from "#habits/schedule.util";
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeTotalCompletions,
} from "#habits/streak.util";

async function habitStats(habit: Habit, ctx: GraphQLContext) {
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
  const points = computePoints(totalCompletions, currentStreak);

  return { entries, currentStreak, longestStreak, totalCompletions, points };
}

export default {
  Query: {
    habits: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.habitsService.findAll(),
    archivedHabits: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.habitsService.findArchived(),
    todayHabits: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.habitsService.findDueToday(),
    habit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.habitsService.findOneOrFail(args.id),
  },
  Mutation: {
    createHabit: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const input = createHabitSchema.parse(args.input);
      return ctx.habitsService.create(input);
    },
    updateHabit: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) => {
      const input = updateHabitSchema.parse(args.input);
      return ctx.habitsService.update(args.id, input);
    },
    archiveHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.habitsService.archive(args.id),
    unarchiveHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.habitsService.unarchive(args.id),
    pauseHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.habitsService.pause(args.id),
    resumeHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.habitsService.resume(args.id),
  },
  Habit: {
    todayEntry: (habit: Habit, _: unknown, ctx: GraphQLContext): Promise<HabitEntry | null> =>
      ctx.todayEntryLoader.load(habit.id),
    paused: (habit: Habit) => habit.pausedAt != null,
    // GraphQL's String scalar coerces a bare Date via isFinite() (true, since
    // Date -> Number gives epoch ms), silently serializing it as a numeric
    // string instead of the date's own toString/ISO form — always resolve
    // Date columns explicitly rather than let the default identity resolver
    // hand a Date straight to a String field.
    archivedAt: (habit: Habit) => habit.archivedAt?.toISOString() ?? null,
    pausedAt: (habit: Habit) => habit.pausedAt?.toISOString() ?? null,
    createdAt: (habit: Habit) => habit.createdAt.toISOString(),
    updatedAt: (habit: Habit) => habit.updatedAt.toISOString(),

    currentStreak: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      (await habitStats(habit, ctx)).currentStreak,
    longestStreak: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      (await habitStats(habit, ctx)).longestStreak,
    totalCompletions: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      (await habitStats(habit, ctx)).totalCompletions,
    points: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      (await habitStats(habit, ctx)).points,
    level: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      computeLevel((await habitStats(habit, ctx)).points),
    levelTitle: async (habit: Habit, _: unknown, ctx: GraphQLContext) =>
      levelTitle(computeLevel((await habitStats(habit, ctx)).points)),

    heatmap: async (habit: Habit, _: unknown, ctx: GraphQLContext) => {
      const entries = await ctx.entriesSinceLoader.load(habit.id);
      const byDate = new Map(
        entries.map((entry) => [entry.date.toISOString().slice(0, 10), entry]),
      );
      const days: { date: string; completed: boolean; value: number | null }[] = [];
      const today = new Date();

      for (let offset = STATS_WINDOW_DAYS - 1; offset >= 0; offset--) {
        const date = new Date(today);
        date.setDate(date.getDate() - offset);
        const key = date.toISOString().slice(0, 10);
        const entry = byDate.get(key);
        days.push({
          date: key,
          completed: entry?.completed ?? false,
          value: entry?.value ?? null,
        });
      }
      return days;
    },
  },
};
