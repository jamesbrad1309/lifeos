import { createFileRoute } from "@tanstack/react-router";
import { DayCalendar } from "#components/DayCalendar";
import { HABITS_QUERY } from "#graphql/habits";

export const Route = createFileRoute("/habits/today")({
  staticData: { page: "today" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: HABITS_QUERY });
  },
  component: DayCalendar,
});
