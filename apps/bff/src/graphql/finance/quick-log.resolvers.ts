import type {
  ApiAccount,
  ApiQuickLogContext,
  ApiQuickLogResult,
  ApiQuickPreset,
} from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

export default {
  Query: {
    quickLogContext: (
      _: unknown,
      args: { hour: number; dayOfWeek: number; utcOffsetMinutes: number },
      ctx: GraphQLContext,
    ) => ctx.api.get<ApiQuickLogContext>(`/quick-log/context${queryString(args)}`),
  },
  Mutation: {
    quickLog: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiQuickLogResult>("/quick-log", args.input),
    createQuickPreset: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiQuickPreset>("/quick-log/presets", args.input),
    deleteQuickPreset: async (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      (await ctx.api.delete<{ id: string }>(`/quick-log/presets/${encodeURIComponent(args.id)}`))
        .id,
  },
  QuickLogContext: {
    defaultAccount: (c: ApiQuickLogContext, _: unknown, ctx: GraphQLContext) =>
      c.defaultAccountId ? ctx.loaders.accountById.load(c.defaultAccountId) : null,
    accounts: (_: ApiQuickLogContext, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiAccount[]>("/accounts"),
    recentPayees: (c: ApiQuickLogContext) => c.recentPayees,
  },
  PayeeHint: {
    category: (p: { categoryId: string | null }, _: unknown, ctx: GraphQLContext) =>
      p.categoryId ? ctx.loaders.categoryById.load(p.categoryId) : null,
  },
  QuickPreset: {
    category: (p: ApiQuickPreset, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.categoryById.load(p.categoryId),
    account: (p: ApiQuickPreset, _: unknown, ctx: GraphQLContext) =>
      p.accountId ? ctx.loaders.accountById.load(p.accountId) : null,
  },
};
