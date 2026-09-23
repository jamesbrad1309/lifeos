import { useMutation, useQuery } from "@apollo/client/react";
import { Badge } from "#components/ui/badge";
import { Card, CardContent } from "#components/ui/card";
import { Checkbox } from "#components/ui/checkbox";
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

/**
 * A single-day timeline: habits with a `startTime` are placed at their
 * time-of-day offset (see EditHabitDialog for setting it); habits without
 * one show as a chip list above, since they have no natural vertical
 * position. Only habits actually due today (per their schedule) appear —
 * a Mon/Wed/Fri habit doesn't show up on a Tuesday.
 */
export function DayCalendar() {
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-destructive">{error.message}</p>;

  const today = new Date();
  const dueToday = (data?.habits ?? []).filter(
    (habit) => !habit.paused && isDueOn(habit.schedule, today),
  );
  const timed = dueToday
    .filter((habit): habit is Habit & { startTime: string } => habit.startTime != null)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const anytime = dueToday.filter((habit) => habit.startTime == null);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-col gap-4">
      {anytime.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-6">
            <span className="text-sm text-muted-foreground">Anytime today:</span>
            {anytime.map((habit) => (
              <Badge key={habit.id} variant={habit.todayEntry?.completed ? "success" : "secondary"}>
                {habit.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {dueToday.length === 0 && (
        <p className="text-muted-foreground">Nothing scheduled for today.</p>
      )}

      {timed.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <span className="-translate-y-1/2 absolute left-0 bg-background pr-2 text-xs text-muted-foreground">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}

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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
