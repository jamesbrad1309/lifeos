import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JournalView } from "#components/journal/JournalView";
import { JOURNAL_DAYS_QUERY, JOURNAL_ENTRIES_QUERY } from "#graphql/journal";
import { addDays, fromIsoDate, startOfWeek, toIsoDate, todayIsoDate } from "#lib/dates";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => toIsoDate(fromIsoDate(value)) === value, "Not a calendar date");

const searchSchema = z.object({
  // `/journal` is always today; only past days are written into the URL. A
  // malformed `?date=` falls back to today rather than erroring.
  date: isoDate.optional().catch(undefined),
});

/** The day to show: the requested one, unless it's missing or in the future. */
function shownDate(requested: string | undefined): string {
  const today = todayIsoDate();
  return requested && requested < today ? requested : today;
}

export const Route = createFileRoute("/journal")({
  staticData: { page: "journal" },
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ context: { apolloClient }, deps }) => {
    const date = shownDate(deps.date);
    const from = startOfWeek(date);
    await Promise.all([
      apolloClient.query({ query: JOURNAL_ENTRIES_QUERY, variables: { date } }),
      apolloClient.query({ query: JOURNAL_DAYS_QUERY, variables: { from, to: addDays(from, 6) } }),
    ]);
  },
  component: JournalPage,
});

function JournalPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const date = shownDate(search.date);

  return (
    <JournalView
      date={date}
      onDateChange={(next) =>
        // Stepping between days keeps the scroll position, like a tab switch.
        navigate({ search: next < todayIsoDate() ? { date: next } : {}, resetScroll: false })
      }
    />
  );
}
