import type { GraphQLContext } from "#graphql/context";

const path = (code: string) => `/currencies/${encodeURIComponent(code)}`;

/** Passes through to the API's /currencies; conversion itself happens in the API. */
export default {
  Query: {
    currencySettings: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<unknown>("/currencies"),
  },
  Mutation: {
    addCurrency: async (_: unknown, args: { code: string }, ctx: GraphQLContext) => {
      await ctx.api.post<unknown>("/currencies", { code: args.code });
      return true;
    },
    removeCurrency: async (_: unknown, args: { code: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(path(args.code));
      return true;
    },
    setMainCurrency: async (_: unknown, args: { code: string }, ctx: GraphQLContext) => {
      await ctx.api.post<unknown>(`${path(args.code)}/main`);
      return true;
    },
    setExchangeRateOverride: async (
      _: unknown,
      args: { code: string; rateToMain?: number | null },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.put<unknown>(`${path(args.code)}/override`, {
        rateToMain: args.rateToMain ?? null,
      });
      return true;
    },
    refreshExchangeRates: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.post<unknown>("/currencies/refresh-rates"),
  },
};
