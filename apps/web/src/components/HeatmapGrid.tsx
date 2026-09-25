import { useTranslation } from "react-i18next";
import type { HeatmapDay } from "#graphql/types";
import { formatShortDate } from "#lib/dates";
import { cn } from "#lib/utils";

function cellClass(day: HeatmapDay | undefined): string {
  if (!day) return "bg-transparent";
  if (day.completed) return "bg-emerald-500 dark:bg-emerald-500";
  if (day.value != null) return "bg-emerald-300 dark:bg-emerald-800";
  return "bg-muted";
}

/**
 * GitHub-contribution-style grid: `days` is chronological (oldest first,
 * one entry per day — see graphql/habits/habits.resolvers.ts's `heatmap`
 * field), reshaped here into Sunday-aligned week columns of 7 day-rows.
 */
export function HeatmapGrid({ days }: { days: HeatmapDay[] }) {
  const { t } = useTranslation();
  if (days.length === 0) return null;

  const leadingBlanks = new Date(days[0].date).getDay();
  const cells: (HeatmapDay | undefined)[] = [...Array(leadingBlanks).fill(undefined), ...days];
  const weeks: (HeatmapDay | undefined)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="flex gap-[3px] overflow-x-auto py-1">
      {weeks.map((week, weekIdx) => (
        <div
          key={week.find((d) => d)?.date ?? `week-${weekIdx}`}
          className="flex flex-col gap-[3px]"
        >
          {week.map((day, dayIdx) => (
            <div
              key={day?.date ?? `blank-${weekIdx}-${dayIdx}`}
              title={
                day
                  ? day.completed
                    ? t("habits.card.doneOn", { date: formatShortDate(day.date) })
                    : formatShortDate(day.date)
                  : undefined
              }
              className={cn("size-[10px] rounded-[2px]", cellClass(day))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
