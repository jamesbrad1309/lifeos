import { ApolloProvider } from "@apollo/client/react";
import { DayCalendar } from "#components/DayCalendar";
import { HabitsDashboard } from "#components/HabitsDashboard";
import { JournalView } from "#components/journal/JournalView";
import { AppShell } from "#components/layout/AppShell";
import { useHashView } from "#hooks/useHashView";
import { apolloClient } from "#lib/apollo-client";

function App() {
  const view = useHashView();

  return (
    <ApolloProvider client={apolloClient}>
      <AppShell view={view}>
        {view === "dashboard" && <HabitsDashboard />}
        {view === "today" && <DayCalendar />}
        {view === "journal" && <JournalView />}
      </AppShell>
    </ApolloProvider>
  );
}

export default App;
