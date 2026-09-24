import { ApolloProvider } from "@apollo/client/react";
import { useState } from "react";
import { CreateHabitForm } from "#components/CreateHabitForm";
import { DashboardHeader } from "#components/DashboardHeader";
import { DayCalendar } from "#components/DayCalendar";
import { HabitList } from "#components/HabitList";
import { JournalView } from "#components/journal/JournalView";
import { Button } from "#components/ui/button";
import { apolloClient } from "#lib/apollo-client";

type View = "dashboard" | "day" | "journal";

const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Habit Dashboard", subtitle: "Keep your streaks alive." },
  day: { title: "Habit Dashboard", subtitle: "Keep your streaks alive." },
  journal: { title: "Journal", subtitle: "What you did, felt, and what happened." },
};

function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <ApolloProvider client={apolloClient}>
      <div className="min-h-svh bg-muted/30">
        <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{HEADINGS[view].title}</h1>
              <p className="text-sm text-muted-foreground">{HEADINGS[view].subtitle}</p>
            </div>
            <div className="flex gap-1 rounded-md border bg-background p-1">
              <Button
                size="sm"
                variant={view === "dashboard" ? "default" : "ghost"}
                onClick={() => setView("dashboard")}
              >
                Dashboard
              </Button>
              <Button
                size="sm"
                variant={view === "day" ? "default" : "ghost"}
                onClick={() => setView("day")}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={view === "journal" ? "default" : "ghost"}
                onClick={() => setView("journal")}
              >
                Journal
              </Button>
            </div>
          </header>

          {view === "journal" ? (
            <JournalView />
          ) : (
            <>
              <DashboardHeader />
              <CreateHabitForm />
              {view === "dashboard" ? <HabitList /> : <DayCalendar />}
            </>
          )}
        </main>
      </div>
    </ApolloProvider>
  );
}

export default App;
