import type { ApiAccount, ApiAccountMetrics, ApiNetWorth } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

const accountPath = (id: string) => `/accounts/${encodeURIComponent(id)}`;

/** Resolves one derived field from the request's batched `accountMetrics` load. */
const metric =
  <K extends keyof ApiAccountMetrics>(key: K) =>
  async (account: ApiAccount, _: unknown, ctx: GraphQLContext) =>
    (await ctx.loaders.accountMetrics.load(account.id))[key];

/**
 * Maps GraphQL operations onto the API's /accounts endpoints. Money rules
 * (signs, defaults, derived card and loan values) all live in the API; the
 * derived fields share one batched load per request.
 */
export default {
  Query: {
    accounts: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiAccount[]>("/accounts"),
    archivedAccounts: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiAccount[]>("/accounts?archived=true"),
    netWorth: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiNetWorth>("/accounts/net-worth"),
  },
  Mutation: {
    createAccount: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiAccount>("/accounts", args.input),
    updateAccount: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.put<ApiAccount>(accountPath(args.id), args.input),
    archiveAccount: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiAccount>(`${accountPath(args.id)}/archive`),
    unarchiveAccount: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiAccount>(`${accountPath(args.id)}/unarchive`),
    setDefaultAccount: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiAccount>(`${accountPath(args.id)}/default`),
    reorderAccounts: (_: unknown, args: { ids: string[] }, ctx: GraphQLContext) =>
      ctx.api.post<ApiAccount[]>("/accounts/reorder", { ids: args.ids }),
    reconcileAccount: (
      _: unknown,
      args: { id: string; actualBalanceMinor: number; date: string },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<ApiAccount>(`${accountPath(args.id)}/reconcile`, {
        actualBalanceMinor: args.actualBalanceMinor,
        date: args.date,
      }),
  },
  Account: {
    balanceMinor: metric("balanceMinor"),
    balanceMainMinor: metric("balanceMainMinor"),
    availableCreditMinor: metric("availableCreditMinor"),
    utilization: metric("utilization"),
    nextDueDate: metric("nextDueDate"),
    currentStatementSpendMinor: metric("currentStatementSpendMinor"),
    estimatedPayoffMonth: metric("estimatedPayoffMonth"),
    paymentCoversInterest: metric("paymentCoversInterest"),
  },
};
