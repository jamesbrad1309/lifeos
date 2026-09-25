import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SpendingView } from "#components/finance/reports/SpendingView";
import { SPEND_BY_CATEGORY_QUERY } from "#graphql/finance";
import { currentMonth } from "#lib/dates";

export const Route = createFileRoute("/finance/spending")({
  staticData: { page: "spending" },
  validateSearch: z.object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .catch(undefined),
    account: z.string().uuid().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { apolloClient }, deps }) => {
    await apolloClient.query({
      query: SPEND_BY_CATEGORY_QUERY,
      variables: { month: deps.month ?? currentMonth(), accountId: deps.account ?? null },
    });
  },
  component: SpendingPage,
});

function SpendingPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SpendingView
      search={search}
      onSearchChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
