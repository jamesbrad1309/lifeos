import type { ApiCategory, ApiTransaction, ApiTransactionPage } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const transactionPath = (id: string) => `/transactions/${encodeURIComponent(id)}`;

interface TransactionFilter {
  accountId?: string | null;
  categoryId?: string | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
  includeTransfers?: boolean | null;
  uncategorisedOnly?: boolean | null;
}

/**
 * Transactions and categories. A list's `account` and `category` fields go
 * through the request's DataLoaders: one batched call each, however many rows.
 */
export default {
  Query: {
    categories: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiCategory[]>("/categories"),
    transactions: (
      _: unknown,
      args: { filter?: TransactionFilter | null; first: number; after?: string | null },
      ctx: GraphQLContext,
    ) => {
      const f = args.filter ?? {};
      return ctx.api.get<ApiTransactionPage>(
        `/transactions${queryString({
          accountId: f.accountId,
          categoryId: f.categoryId,
          from: f.from,
          to: f.to,
          search: f.search || null,
          includeTransfers: f.includeTransfers,
          uncategorised: f.uncategorisedOnly,
          first: args.first,
          after: args.after,
        })}`,
      );
    },
    toReviewCount: async (_: unknown, __: unknown, ctx: GraphQLContext) =>
      (await ctx.api.get<{ count: number }>("/transactions/to-review-count")).count,
  },
  Mutation: {
    createTransaction: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiTransaction>("/transactions", args.input),
    updateTransaction: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch<ApiTransaction>(transactionPath(args.id), args.input),
    previewCsvImport: (
      _: unknown,
      args: { uploadId: string; accountId: string; mapping: unknown },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<unknown>(`/imports/${encodeURIComponent(args.uploadId)}/preview`, {
        accountId: args.accountId,
        mapping: args.mapping,
      }),
    commitCsvImport: (
      _: unknown,
      args: { uploadId: string; accountId: string; mapping: unknown; includeMatched?: boolean },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<unknown>(`/imports/${encodeURIComponent(args.uploadId)}/commit`, {
        accountId: args.accountId,
        mapping: args.mapping,
        includeMatched: args.includeMatched ?? false,
      }),
    discardCsvImport: async (_: unknown, args: { uploadId: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(`/imports/${encodeURIComponent(args.uploadId)}`);
      return true;
    },
    createTransfer: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiTransaction[]>("/transactions/transfers", args.input),
    deleteTransaction: async (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      (await ctx.api.delete<{ ids: string[] }>(transactionPath(args.id))).ids,
    createCategory: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiCategory>("/categories", args.input),
    dismissPresetSuggestion: async (
      _: unknown,
      args: { categoryId: string; key: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post<unknown>(
        `/categories/${encodeURIComponent(args.categoryId)}/dismiss-preset-suggestion`,
        { key: args.key },
      );
      return true;
    },
  },
  Transaction: {
    account: (t: ApiTransaction, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.accountById.load(t.accountId),
    category: (t: ApiTransaction, _: unknown, ctx: GraphQLContext) =>
      t.categoryId ? ctx.loaders.categoryById.load(t.categoryId) : null,
    isTransfer: (t: ApiTransaction) => t.transferId != null,
    transferAccount: (t: ApiTransaction, _: unknown, ctx: GraphQLContext) => {
      const id = (t.metadata as { transferAccountId?: string }).transferAccountId;
      return t.transferId && id ? ctx.loaders.accountById.load(id) : null;
    },
  },
  CsvPreviewRow: {
    status: (r: { status: string }) =>
      ({ new: "NEW", duplicate: "DUPLICATE", matched: "MATCHED", beforeOpening: "BEFORE_OPENING" })[
        r.status
      ],
    category: (r: { categoryId: string | null }, _: unknown, ctx: GraphQLContext) =>
      r.categoryId ? ctx.loaders.categoryById.load(r.categoryId) : null,
  },
  Category: {
    aliases: (c: ApiCategory) => c.metadata?.aliases ?? [],
    key: (c: ApiCategory) => c.metadata?.key ?? null,
  },
};
