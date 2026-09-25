import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const PACE = { "on-track": "ON_TRACK", close: "CLOSE", over: "OVER" } as const;

/** Budget math lives in the API; this maps the pace names onto the GraphQL enum. */
export default {
  Query: {
    budget: (_: unknown, args: { month: string; today?: string | null }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/budgets${queryString(args)}`),
  },
  Mutation: {
    setBudget: async (_: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      await ctx.api.put<unknown>("/budgets", args.input);
      return true;
    },
    removeBudget: async (
      _: unknown,
      args: { categoryId: string; month: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post<unknown>("/budgets/remove", args);
      return true;
    },
  },
  BudgetLine: {
    pace: (line: { pace: keyof typeof PACE }) => PACE[line.pace],
  },
};
