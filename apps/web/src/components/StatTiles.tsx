import { useQuery } from "@apollo/client/react";
import { CheckCircle2, Flame, type LucideIcon, Medal, Star, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "#components/ui/card";
import { Progress } from "#components/ui/progress";
import { DASHBOARD_STATS_QUERY, HABITS_QUERY } from "#graphql/habits";
import type { DashboardStatsData, HabitsData } from "#graphql/types";
import { isDueOn } from "#lib/schedule";

function Tile({
  icon: Icon,
  iconClass,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={`size-4 ${iconClass}`} />
          {label}
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** The headline numbers across the top of the dashboard. */
export function StatTiles() {
  const { data: statsData } = useQuery<DashboardStatsData>(DASHBOARD_STATS_QUERY);
  const { data: habitsData } = useQuery<HabitsData>(HABITS_QUERY);
  const stats = statsData?.dashboardStats;

  const today = new Date();
  const due = (habitsData?.habits ?? []).filter((h) => !h.paused && isDueOn(h.schedule, today));
  const done = due.filter((h) => h.todayEntry?.completed).length;
  const donePct = due.length > 0 ? Math.round((done / due.length) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <Tile
        icon={CheckCircle2}
        iconClass="text-emerald-500"
        label="Done today"
        value={
          <>
            {done}
            <span className="text-base font-normal text-muted-foreground"> / {due.length}</span>
          </>
        }
      >
        <Progress value={donePct} className="h-1.5" />
      </Tile>
      <Tile
        icon={Flame}
        iconClass="text-orange-500"
        label="Active streaks"
        value={stats?.activeStreakCount ?? "–"}
      />
      <Tile
        icon={Medal}
        iconClass="text-amber-500"
        label="Longest streak"
        value={stats ? `${stats.longestOverallStreak}d` : "–"}
      />
      <Tile
        icon={Star}
        iconClass="text-violet-500"
        label="Total XP"
        value={stats?.totalPoints ?? "–"}
      />
      <Tile
        icon={Target}
        iconClass="text-sky-500"
        label="Active habits"
        value={
          stats ? (
            <>
              {stats.totalHabits - stats.pausedHabits}
              {stats.pausedHabits > 0 && (
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  +{stats.pausedHabits} paused
                </span>
              )}
            </>
          ) : (
            "–"
          )
        }
      />
    </div>
  );
}
