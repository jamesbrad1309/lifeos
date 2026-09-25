import { createFileRoute } from "@tanstack/react-router";
import { MoneySetup } from "#components/finance/setup/MoneySetup";
import { ACCOUNTS_QUERY } from "#graphql/finance";

export const Route = createFileRoute("/finance/accounts")({
  staticData: { page: "accounts" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ACCOUNTS_QUERY });
  },
  component: MoneySetup,
});
