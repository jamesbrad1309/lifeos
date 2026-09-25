import { useMutation } from "@apollo/client/react";
import { Archive, Clock, Flame, Pause, Play, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EditHabitDialog } from "#components/EditHabitDialog";
import { HeatmapGrid } from "#components/HeatmapGrid";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import { Checkbox } from "#components/ui/checkbox";
import { Input } from "#components/ui/input";
import {
  ARCHIVE_HABIT_MUTATION,
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  PAUSE_HABIT_MUTATION,
  RESUME_HABIT_MUTATION,
  UPSERT_HABIT_ENTRY_MUTATION,
} from "#graphql/habits";
import type { Habit } from "#graphql/types";
import { cn } from "#lib/utils";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HabitCard({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  // Any of these can change dashboardStats (points/streaks aggregate across
  // all habits), which Apollo's cache normalization can't infer on its own
  // since DashboardStats isn't keyed by habit id — refetch it explicitly.
  const refetchQueries = [{ query: DASHBOARD_STATS_QUERY }];
  // Archiving removes a row from the `habits` list query's array, which
  // normalization also can't do on its own (it only updates existing
  // entities, never a list's membership) — refetch the list for that one.
  const refetchList = [...refetchQueries, { query: HABITS_QUERY }];

  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, { refetchQueries });
  const [pauseHabit] = useMutation(PAUSE_HABIT_MUTATION, { refetchQueries });
  const [resumeHabit] = useMutation(RESUME_HABIT_MUTATION, { refetchQueries });
  const [archiveHabit] = useMutation(ARCHIVE_HABIT_MUTATION, { refetchQueries: refetchList });

  const entry = habit.todayEntry;

  return (
    <Card className={cn(habit.paused && "opacity-60")}>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{habit.name}</CardTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {habit.currentStreak > 0 && (
              <Badge variant="warning" className="gap-1">
                <Flame className="size-3" />
                {t("habits.card.streak", { count: habit.currentStreak })}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" />
              {t("habits.card.level", { level: habit.level, points: habit.points })}
            </Badge>
            {habit.paused && <Badge variant="outline">{t("habits.card.paused")}</Badge>}
            {habit.startTime && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {habit.startTime}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Checkbox
            checked={entry?.completed ?? false}
            disabled={habit.paused}
            onCheckedChange={(checked) =>
              upsertEntry({
                variables: {
                  input: {
                    habitId: habit.id,
                    date: todayIso(),
                    completed: checked === true,
                    value: entry?.value ?? undefined,
                  },
                },
              })
            }
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {habit.unit ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Input
              type="number"
              className="w-24"
              defaultValue={entry?.value ?? ""}
              placeholder="0"
              disabled={habit.paused}
              onBlur={(e) => {
                const value = e.target.value === "" ? undefined : Number(e.target.value);
                upsertEntry({
                  variables: {
                    input: {
                      habitId: habit.id,
                      date: todayIso(),
                      value,
                      completed: entry?.completed ?? false,
                    },
                  },
                });
              }}
            />
            <span>
              {habit.unit}
              {habit.targetValue ? ` / ${habit.targetValue}` : ""}
            </span>
          </div>
        ) : null}

        <HeatmapGrid days={habit.heatmap} />

        <div className="flex justify-end gap-1 border-t pt-2">
          <EditHabitDialog habit={habit} />
          {habit.paused ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resumeHabit({ variables: { id: habit.id } })}
            >
              <Play className="size-3.5" /> {t("habits.card.resume")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pauseHabit({ variables: { id: habit.id } })}
            >
              <Pause className="size-3.5" /> {t("habits.card.pause")}
            </Button>
          )}
          {confirmingArchive ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingArchive(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => archiveHabit({ variables: { id: habit.id } })}
              >
                <Archive className="size-3.5" /> {t("habits.card.confirmArchive")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingArchive(true)}>
              <Archive className="size-3.5" /> {t("common.archive")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
