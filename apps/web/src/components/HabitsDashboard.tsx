import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { CreateHabitForm } from "#components/CreateHabitForm";
import { HabitList } from "#components/HabitList";
import { StatTiles } from "#components/StatTiles";
import { HABITS_QUERY } from "#graphql/habits";
import type { HabitsData } from "#graphql/types";

export function HabitsDashboard() {
  const { t } = useTranslation();
  const { data } = useQuery<HabitsData>(HABITS_QUERY);
  const count = data?.habits.length;

  return (
    <div className="flex flex-col gap-6">
      <StatTiles />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t("habits.yourHabits")}
            {count !== undefined && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
            )}
          </h2>
          <CreateHabitForm className="w-full sm:w-auto sm:min-w-[28rem]" />
        </div>
        <HabitList />
      </section>
    </div>
  );
}
