import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import {
  PAGE_SIZE,
  TransactionsView,
  transactionFilter,
} from "#components/finance/transactions/TransactionsView";
import { TRANSACTIONS_QUERY } from "#graphql/finance";

const searchSchema = z.object({
  view: z.enum(["all", "review"]).catch("all").default("all"),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  account: z.string().uuid().optional().catch(undefined),
  category: z.string().uuid().optional().catch(undefined),
  // Coerced: the router JSON-parses search values, so "?q=12" arrives as a number.
  q: z.coerce.string().max(100).optional().catch(undefined),
});

export const Route = createFileRoute("/finance/transactions")({
  staticData: { page: "transactions" },
  validateSearch: searchSchema,
  // `/finance/transactions` means the "All" view; don't spell it out in the URL.
  search: { middlewares: [stripSearchParams({ view: "all" })] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { apolloClient }, deps }) => {
    await apolloClient.query({
      query: TRANSACTIONS_QUERY,
      variables: { filter: transactionFilter(deps), first: PAGE_SIZE },
    });
  },
  component: TransactionsPage,
});

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <TransactionsView
      search={search}
      onSearchChange={(next, options) =>
        navigate({ search: (prev) => ({ ...prev, ...next }), replace: options?.replace })
      }
    />
  );
}
