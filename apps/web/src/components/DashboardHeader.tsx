import { useQuery } from "@apollo/client/react";
import { Flame, Trophy } from "lucide-react";
import { Badge } from "#components/ui/badge";
import { Card, CardContent } from "#components/ui/card";
import { Progress } from "#components/ui/progress";
import { DASHBOARD_STATS_QUERY } from "#graphql/habits";
import type { DashboardStatsData } from "#graphql/types";

export function DashboardHeader() {
  const { data } = useQuery<DashboardStatsData>(DASHBOARD_STATS_QUERY);
  const stats = data?.dashboardStats;

  if (!stats) return null;

  const progressPct =
    stats.pointsForNextLevel > 0
      ? Math.min(100, Math.round((stats.pointsIntoLevel / stats.pointsForNextLevel) * 100))
      : 100;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Level {stats.level}</span>
              <Badge variant="secondary">{stats.levelTitle}</Badge>
            </div>
            <div className="mt-1 w-40">
              <Progress value={progressPct} />
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.pointsIntoLevel} / {stats.pointsForNextLevel} XP
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6 text-sm">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Flame className="size-4 text-orange-500" />
              Active streaks
            </div>
            <p className="text-lg font-semibold">{stats.activeStreakCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Longest streak</p>
            <p className="text-lg font-semibold">{stats.longestOverallStreak}d</p>
          </div>
          <div>
            <p className="text-muted-foreground">Habits</p>
            <p className="text-lg font-semibold">
              {stats.totalHabits - stats.pausedHabits}
              {stats.pausedHabits > 0 && (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  (+{stats.pausedHabits} paused)
                </span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
