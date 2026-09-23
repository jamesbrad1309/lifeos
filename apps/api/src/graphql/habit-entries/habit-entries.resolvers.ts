import type { HabitEntry } from "@prisma/client";
import type { GraphQLContext } from "#graphql/context";
import { upsertHabitEntrySchema } from "#habit-entries/dto/upsert-habit-entry.dto";

export default {
  Query: {
    habitEntries: (_: unknown, args: { habitId: string }, ctx: GraphQLContext) =>
      ctx.habitEntriesService.findForHabit(args.habitId),
  },
  Mutation: {
    upsertHabitEntry: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const input = upsertHabitEntrySchema.parse(args.input);
      return ctx.habitEntriesService.upsert(input);
    },
  },
  HabitEntry: {
    // see the comment in graphql/habits/habits.resolvers.ts on Date -> String coercion
    date: (entry: HabitEntry) => entry.date.toISOString().slice(0, 10),
    createdAt: (entry: HabitEntry) => entry.createdAt.toISOString(),
  },
};
