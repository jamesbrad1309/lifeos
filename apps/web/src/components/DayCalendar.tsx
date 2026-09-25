import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import { Checkbox } from "#components/ui/checkbox";
import { Progress } from "#components/ui/progress";
import { DASHBOARD_STATS_QUERY, HABITS_QUERY, UPSERT_HABIT_ENTRY_MUTATION } from "#graphql/habits";
import type { Habit, HabitsData } from "#graphql/types";
import { isDueOn, timeToMinutes } from "#lib/schedule";
import { cn } from "#lib/utils";

const START_HOUR = 5;
const END_HOUR = 23;
const HOUR_HEIGHT = 56;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function HabitBlock({ habit, top }: { habit: Habit; top: number }) {
  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, {
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }],
  });
  const completed = habit.todayEntry?.completed ?? false;

  return (
    <div
      className={cn(
        "absolute right-2 left-16 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm shadow-sm",
        completed ? "border-emerald-500 bg-emerald-500/10" : "bg-card",
      )}
      style={{ top }}
    >
      <div>
        <span className="font-medium">{habit.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{habit.startTime}</span>
      </div>
      <Checkbox
        checked={completed}
        onCheckedChange={(checked) =>
          upsertEntry({
            variables: {
              input: {
                habitId: habit.id,
                date: todayIso(),
                completed: checked === true,
                value: habit.todayEntry?.value ?? undefined,
              },
            },
          })
        }
      />
    </div>
  );
}

function AnytimeRow({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, {
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }],
  });
  const completed = habit.todayEntry?.completed ?? false;
  const id = `anytime-${habit.id}`;

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50">
      <Checkbox
        id={id}
        checked={completed}
        onCheckedChange={(checked) =>
          upsertEntry({
            variables: {
              input: {
                habitId: habit.id,
                date: todayIso(),
                completed: checked === true,
                value: habit.todayEntry?.value ?? undefined,
              },
            },
          })
        }
      />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          completed && "text-muted-foreground line-through",
        )}
      >
        {habit.name}
      </label>
      {habit.currentStreak > 0 && (
        <span className="text-xs text-muted-foreground">
          🔥 {t("habits.tiles.days", { count: habit.currentStreak })}
        </span>
      )}
    </li>
  );
}

/**
 * A single-day timeline: habits with a `startTime` are placed at their
 * time-of-day offset (see EditHabitDialog for setting it) and fill the main
 * column; habits without one have no natural vertical position, so they sit
 * in a checklist beside it with today's progress. Only habits actually due
 * today (per their schedule) appear — a Mon/Wed/Fri habit doesn't show up
 * on a Tuesday.
 */
export function DayCalendar() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY);

  if (loading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (error) return <p className="text-destructive">{error.message}</p>;

  const today = new Date();
  const dueToday = (data?.habits ?? []).filter(
    (habit) => !habit.paused && isDueOn(habit.schedule, today),
  );
  const timed = dueToday
    .filter((habit): habit is Habit & { startTime: string } => habit.startTime != null)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const anytime = dueToday.filter((habit) => habit.startTime == null);
  const done = dueToday.filter((habit) => habit.todayEntry?.completed).length;
  const pct = dueToday.length > 0 ? Math.round((done / dueToday.length) * 100) : 0;

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNow = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="order-2 lg:order-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("habits.today.schedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          {timed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("habits.today.noTimed")}
            </p>
          ) : (
            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <span className="-translate-y-1/2 absolute left-0 bg-card pr-2 text-xs text-muted-foreground">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {showNow && (
                <div
                  aria-hidden
                  className="absolute right-0 left-14 z-10 border-t-2 border-rose-500"
                  style={{ top: nowTop }}
                >
                  <span className="-top-[5px] -left-1 absolute size-2 rounded-full bg-rose-500" />
                </div>
              )}

              {timed.map((habit) => {
                const minutesFromStart = timeToMinutes(habit.startTime) - START_HOUR * 60;
                return (
                  <HabitBlock
                    key={habit.id}
                    habit={habit}
                    top={(minutesFromStart / 60) * HOUR_HEIGHT}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="order-1 flex flex-col gap-4 lg:sticky lg:top-0 lg:order-2">
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-sm text-muted-foreground">{t("habits.today.progress")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {done}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                {t("habits.today.doneOf", { total: dueToday.length })}
              </span>
            </p>
            <Progress value={pct} className="h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("habits.today.anytime")}</CardTitle>
          </CardHeader>
          <CardContent>
            {anytime.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {dueToday.length === 0
                  ? t("habits.today.nothingScheduled")
                  : t("habits.today.allTimed")}
              </p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {anytime.map((habit) => (
                  <AnytimeRow key={habit.id} habit={habit} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
