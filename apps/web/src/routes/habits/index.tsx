import { createFileRoute } from "@tanstack/react-router";
import { HabitsDashboard } from "#components/HabitsDashboard";
import { DASHBOARD_STATS_QUERY, HABITS_QUERY } from "#graphql/habits";

export const Route = createFileRoute("/habits/")({
  staticData: { page: "dashboard" },
  // Warms Apollo's cache; the page's own useQuery hooks read from it.
  loader: async ({ context: { apolloClient } }) => {
    await Promise.all([
      apolloClient.query({ query: HABITS_QUERY }),
      apolloClient.query({ query: DASHBOARD_STATS_QUERY }),
    ]);
  },
  component: HabitsDashboard,
});
