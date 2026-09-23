import { useQuery } from "@apollo/client/react";
import { HabitCard } from "#components/HabitCard";
import { HABITS_QUERY } from "#graphql/habits";
import type { HabitsData } from "#graphql/types";

export function HabitList() {
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data?.habits.length) {
    return <p className="text-muted-foreground">No habits yet. Add one below.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.habits.map((habit) => (
        <HabitCard key={habit.id} habit={habit} />
      ))}
    </div>
  );
}
