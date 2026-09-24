import { useQuery } from "@apollo/client/react";
import { Sparkles, Trophy } from "lucide-react";
import { Progress } from "#components/ui/progress";
import { DASHBOARD_STATS_QUERY } from "#graphql/habits";
import type { DashboardStatsData } from "#graphql/types";
import { COMING_SOON, NAV_GROUPS, type ViewId, hrefFor } from "#lib/navigation";
import { cn } from "#lib/utils";

interface Props {
  view: ViewId;
  /** Icon-only rail (desktop). */
  collapsed?: boolean;
  /** Called after a link is followed — the mobile drawer closes itself with it. */
  onNavigate?: () => void;
}

export function Sidebar({ view, collapsed = false, onNavigate }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 py-3">
      <a
        href={hrefFor("dashboard")}
        onClick={onNavigate}
        className={cn("flex h-10 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        {!collapsed && <span className="text-base font-semibold tracking-tight">LifeOS</span>}
      </a>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-3 mb-1 border-t" />
            ) : (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.id === view;
              return (
                <a
                  key={item.id}
                  href={hrefFor(item.id)}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </a>
              );
            })}
          </div>
        ))}

        <div className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-3 mb-1 border-t" />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Coming soon
            </p>
          )}
          {COMING_SOON.map((item) => (
            <span
              key={item.label}
              aria-disabled
              title={collapsed ? `${item.label} (coming soon)` : undefined}
              className={cn(
                "flex h-9 cursor-default items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/60",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {collapsed ? <span className="sr-only">{item.label} (coming soon)</span> : item.label}
            </span>
          ))}
        </div>
      </nav>

      <LevelCard collapsed={collapsed} />
    </div>
  );
}

/** Overall level and XP, always in view whichever page is open. */
function LevelCard({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery<DashboardStatsData>(DASHBOARD_STATS_QUERY);
  const stats = data?.dashboardStats;
  if (!stats) return null;

  const pct =
    stats.pointsForNextLevel > 0
      ? Math.min(100, Math.round((stats.pointsIntoLevel / stats.pointsForNextLevel) * 100))
      : 100;

  if (collapsed) {
    return (
      <div
        className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold"
        title={`Level ${stats.level} · ${stats.levelTitle} · ${stats.pointsIntoLevel}/${stats.pointsForNextLevel} XP`}
      >
        {stats.level}
      </div>
    );
  }

  return (
    <div className="mx-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Trophy className="size-4 text-amber-500" />
        <span className="font-semibold">Level {stats.level}</span>
        <span className="truncate text-xs text-muted-foreground">{stats.levelTitle}</span>
      </div>
      <Progress value={pct} className="mt-2 h-1.5" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {stats.pointsIntoLevel} / {stats.pointsForNextLevel} XP to level {stats.level + 1}
      </p>
    </div>
  );
}
