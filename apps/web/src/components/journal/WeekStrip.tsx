import { useQuery } from "@apollo/client/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { JOURNAL_DAYS_QUERY } from "#graphql/journal";
import type { JournalDay, JournalDaysData } from "#graphql/types";
import {
  addDays,
  formatLongDate,
  formatWeekday,
  fromIsoDate,
  startOfWeek,
  todayIsoDate,
} from "#lib/dates";
import { emotionFor } from "#lib/emotions";
import { cn } from "#lib/utils";

/** The day's most frequent emotion (latest wins a tie), shown as its emoji. */
function dominantEmotion(day: JournalDay | undefined): string | null {
  if (!day || day.emotions.length === 0) return null;
  const counts = new Map<string, number>();
  let best = day.emotions[0];
  for (const name of day.emotions) {
    const count = (counts.get(name) ?? 0) + 1;
    counts.set(name, count);
    if (count >= (counts.get(best) ?? 0)) best = name;
  }
  return emotionFor(best).emoji;
}

interface Props {
  selected: string;
  onSelect: (date: string) => void;
}

/**
 * Mon–Sun for the selected day's week. Each day shows the emoji of its
 * dominant feeling and one dot per kind written, so gaps and heavy days
 * are visible at a glance.
 */
export function WeekStrip({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const from = startOfWeek(selected);
  const to = addDays(from, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  const { data } = useQuery<JournalDaysData>(JOURNAL_DAYS_QUERY, { variables: { from, to } });
  const byDate = new Map((data?.journalDays ?? []).map((day) => [day.date, day]));

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("common.previousWeek")}
        onClick={() => onSelect(addDays(selected, -7))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((date) => {
          const summary = byDate.get(date);
          const emoji = dominantEmotion(summary);
          const isSelected = date === selected;
          const isFuture = date > today;
          const d = fromIsoDate(date);
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              aria-current={isSelected ? "date" : undefined}
              aria-label={formatLongDate(d)}
              onClick={() => onSelect(date)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-xs transition-colors disabled:opacity-40",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent hover:bg-accent",
                date === today && !isSelected && "border-border",
              )}
            >
              <span className="opacity-70">{formatWeekday(d)}</span>
              <span className="text-sm font-semibold">{d.getDate()}</span>
              <span className="flex h-5 items-center text-base leading-none" aria-hidden>
                {emoji ?? ""}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {summary?.actionCount ? (
                  <span className="size-1.5 rounded-full bg-sky-500" />
                ) : null}
                {summary?.feelingCount ? (
                  <span className="size-1.5 rounded-full bg-violet-500" />
                ) : null}
                {summary?.eventCount ? (
                  <span className="size-1.5 rounded-full bg-amber-500" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label={t("common.nextWeek")}
        disabled={to >= today}
        onClick={() => {
          const next = addDays(selected, 7);
          onSelect(next > today ? today : next);
        }}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
