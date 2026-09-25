import { createFileRoute } from "@tanstack/react-router";
import { CurrenciesView } from "#components/finance/currencies/CurrenciesView";
import { CURRENCY_SETTINGS_QUERY } from "#graphql/finance";

export const Route = createFileRoute("/finance/currencies")({
  staticData: { page: "currencies" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: CURRENCY_SETTINGS_QUERY });
  },
  component: CurrenciesView,
});
