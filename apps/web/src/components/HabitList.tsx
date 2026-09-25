import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { HabitCard } from "#components/HabitCard";
import { HABITS_QUERY } from "#graphql/habits";
import type { HabitsData } from "#graphql/types";

export function HabitList() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY);

  if (loading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data?.habits.length) {
    return <p className="text-muted-foreground">{t("habits.none")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {data.habits.map((habit) => (
        <HabitCard key={habit.id} habit={habit} />
      ))}
    </div>
  );
}
