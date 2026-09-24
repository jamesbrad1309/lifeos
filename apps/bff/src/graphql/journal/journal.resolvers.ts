import type { ApiJournalDaySummary, ApiJournalEntry } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

// The API already embeds the trigger and sends dates as "YYYY-MM-DD", so
// these pass straight through with no field resolvers.
export default {
  Query: {
    journalEntries: (_: unknown, args: { date: string }, ctx: GraphQLContext) =>
      ctx.api.get<ApiJournalEntry[]>(`/journal-entries?date=${encodeURIComponent(args.date)}`),
    journalDays: (_: unknown, args: { from: string; to: string }, ctx: GraphQLContext) =>
      ctx.api.get<ApiJournalDaySummary[]>(
        `/journal-entries/days?from=${encodeURIComponent(args.from)}&to=${encodeURIComponent(args.to)}`,
      ),
  },
  Mutation: {
    createJournalEntry: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiJournalEntry>("/journal-entries", args.input),
    createJournalEntries: (_: unknown, args: { entries: unknown[] }, ctx: GraphQLContext) =>
      ctx.api.post<ApiJournalEntry[]>("/journal-entries/batch", args.entries),
    updateJournalEntry: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.put<ApiJournalEntry>(`/journal-entries/${encodeURIComponent(args.id)}`, args.input),
    deleteJournalEntry: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const { id } = await ctx.api.delete<{ id: string }>(
        `/journal-entries/${encodeURIComponent(args.id)}`,
      );
      return id;
    },
  },
};
