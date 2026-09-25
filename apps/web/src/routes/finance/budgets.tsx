import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BudgetsView } from "#components/finance/budgets/BudgetsView";
import { BUDGET_QUERY } from "#graphql/finance";
import { currentMonth, todayIsoDate } from "#lib/dates";

export const Route = createFileRoute("/finance/budgets")({
  staticData: { page: "budgets" },
  validateSearch: z.object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { apolloClient }, deps }) => {
    await apolloClient.query({
      query: BUDGET_QUERY,
      variables: { month: deps.month ?? currentMonth(), today: todayIsoDate() },
    });
  },
  component: BudgetsPage,
});

function BudgetsPage() {
  const { month } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BudgetsView month={month} onMonthChange={(next) => navigate({ search: { month: next } })} />
  );
}
