import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "#components/ui/progress";
import { TO_REVIEW_COUNT_QUERY } from "#graphql/finance";
import { DASHBOARD_STATS_QUERY } from "#graphql/habits";
import type { DashboardStatsData } from "#graphql/types";
import { levelTitle } from "#lib/levels";
import { COMING_SOON, NAV_GROUPS } from "#lib/navigation";
import { cn } from "#lib/utils";

interface Props {
  /** Icon-only rail (desktop). */
  collapsed?: boolean;
  /** Called after a link is followed — the mobile drawer closes itself with it. */
  onNavigate?: () => void;
}

export function Sidebar({ collapsed = false, onNavigate }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-4 py-3">
      <Link
        to="/"
        onClick={onNavigate}
        className={cn("flex h-10 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight">{t("shell.appName")}</span>
        )}
      </Link>

      <nav
        aria-label={t("shell.nav.mainLabel")}
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-2"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-3 mb-1 border-t" />
            ) : (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {t(`shell.nav.groups.${group.label}`)}
              </p>
            )}
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact, includeSearch: false }}
                onClick={onNavigate}
                title={collapsed ? t(`shell.nav.${item.label}`) : undefined}
                className={cn(
                  "relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                )}
                activeProps={{ className: "bg-accent font-medium text-foreground" }}
                inactiveProps={{
                  className: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                }}
              >
                <item.icon className="size-4 shrink-0" />
                {collapsed ? (
                  <span className="sr-only">{t(`shell.nav.${item.label}`)}</span>
                ) : (
                  t(`shell.nav.${item.label}`)
                )}
                {item.badge === "toReview" && <ToReviewBadge collapsed={collapsed} />}
              </Link>
            ))}
          </div>
        ))}

        {COMING_SOON.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-3 mb-1 border-t" />
            ) : (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {t("shell.nav.groups.comingSoon")}
              </p>
            )}
            {COMING_SOON.map((item) => (
              <span
                key={item.label}
                aria-disabled
                title={
                  collapsed
                    ? t("shell.nav.comingSoonItem", { label: t(`shell.nav.${item.label}`) })
                    : undefined
                }
                className={cn(
                  "flex h-9 cursor-default items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/60",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {collapsed ? (
                  <span className="sr-only">
                    {t("shell.nav.comingSoonItem", { label: t(`shell.nav.${item.label}`) })}
                  </span>
                ) : (
                  t(`shell.nav.${item.label}`)
                )}
              </span>
            ))}
          </div>
        )}
      </nav>

      <LevelCard collapsed={collapsed} />
    </div>
  );
}

/** How many quick logs are waiting for a category; hidden at zero. */
function ToReviewBadge({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { data } = useQuery<{ toReviewCount: number }>(TO_REVIEW_COUNT_QUERY);
  const count = data?.toReviewCount ?? 0;
  if (count === 0) return null;
  if (collapsed) {
    return (
      <span className="absolute top-1.5 right-2.5 size-2 rounded-full bg-amber-500">
        <span className="sr-only">, {t("shell.nav.toReview", { count })}</span>
      </span>
    );
  }
  return (
    <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 text-xs font-medium text-amber-700 tabular-nums dark:text-amber-400">
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t("shell.nav.toReview", { count })}</span>
    </span>
  );
}

/** Overall level and XP, always in view whichever page is open. */
function LevelCard({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
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
        title={t("shell.level.tooltip", {
          level: stats.level,
          title: levelTitle(t, stats.level),
          into: stats.pointsIntoLevel,
          needed: stats.pointsForNextLevel,
        })}
      >
        {stats.level}
      </div>
    );
  }

  return (
    <div className="mx-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Trophy className="size-4 text-amber-500" />
        <span className="font-semibold">{t("shell.level.level", { level: stats.level })}</span>
        <span className="truncate text-xs text-muted-foreground">{levelTitle(t, stats.level)}</span>
      </div>
      <Progress value={pct} className="mt-2 h-1.5" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t("shell.level.progress", {
          into: stats.pointsIntoLevel,
          needed: stats.pointsForNextLevel,
          next: stats.level + 1,
        })}
      </p>
    </div>
  );
}
