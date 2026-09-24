import type { ApiHabitEntry } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

// The API already sends `date` as "YYYY-MM-DD" and `createdAt` as an ISO
// string, so HabitEntry needs no field resolvers here.
export default {
  Query: {
    habitEntries: (_: unknown, args: { habitId: string }, ctx: GraphQLContext) =>
      ctx.api.get<ApiHabitEntry[]>(`/habits/${encodeURIComponent(args.habitId)}/entries`),
  },
  Mutation: {
    upsertHabitEntry: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.put<ApiHabitEntry>("/habit-entries", args.input),
  },
};
