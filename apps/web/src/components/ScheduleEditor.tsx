import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { HabitSchedule } from "#graphql/types";
import { formatWeekday } from "#lib/dates";
import { cn } from "#lib/utils";

/** 4 January 2026 was a Sunday: day 0 of the week, like Date.getDay(). */
const dayLabel = (day: number) => formatWeekday(new Date(2026, 0, 4 + day));
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

type Preset = "daily" | "weekdays" | "weekends" | "custom" | "timesPerWeek" | "interval";

function sameDays(a: number[], b: number[]): boolean {
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.length === bs.length && as.every((d, i) => d === bs[i]);
}

function presetOf(schedule: HabitSchedule): Preset {
  switch (schedule.type) {
    case "daily":
      return "daily";
    case "timesPerWeek":
      return "timesPerWeek";
    case "interval":
      return "interval";
    case "weekly":
      if (sameDays(schedule.daysOfWeek, WEEKDAYS)) return "weekdays";
      if (sameDays(schedule.daysOfWeek, WEEKENDS)) return "weekends";
      return "custom";
  }
}

/** Labels are `habits.schedule.<preset>`. */
const PRESETS: Preset[] = ["daily", "weekdays", "weekends", "custom", "timesPerWeek", "interval"];

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: HabitSchedule;
  onChange: (schedule: HabitSchedule) => void;
}) {
  const { t } = useTranslation();
  const preset = presetOf(value);

  function handlePresetChange(next: Preset) {
    switch (next) {
      case "daily":
        onChange({ type: "daily" });
        return;
      case "weekdays":
        onChange({ type: "weekly", daysOfWeek: WEEKDAYS });
        return;
      case "weekends":
        onChange({ type: "weekly", daysOfWeek: WEEKENDS });
        return;
      case "custom":
        onChange({ type: "weekly", daysOfWeek: value.type === "weekly" ? value.daysOfWeek : [1] });
        return;
      case "timesPerWeek":
        onChange({ type: "timesPerWeek", count: value.type === "timesPerWeek" ? value.count : 3 });
        return;
      case "interval":
        onChange({
          type: "interval",
          everyNDays: value.type === "interval" ? value.everyNDays : 2,
        });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="schedule-preset">{t("habits.schedule.label")}</Label>
      <select
        id="schedule-preset"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value as Preset)}
      >
        {PRESETS.map((option) => (
          <option key={option} value={option}>
            {t(`habits.schedule.${option}`)}
          </option>
        ))}
      </select>

      {preset === "custom" && value.type === "weekly" && (
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const label = dayLabel(day);
            const active = value.daysOfWeek.includes(day);
            return (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn("w-11 px-0")}
                onClick={() =>
                  onChange({
                    type: "weekly",
                    daysOfWeek: active
                      ? value.daysOfWeek.filter((d) => d !== day)
                      : [...value.daysOfWeek, day],
                  })
                }
              >
                {label}
              </Button>
            );
          })}
        </div>
      )}

      {preset === "timesPerWeek" && value.type === "timesPerWeek" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={7}
            className="w-20"
            value={value.count}
            onChange={(e) => onChange({ type: "timesPerWeek", count: Number(e.target.value) || 1 })}
          />
          <span className="text-sm text-muted-foreground">
            {t("habits.schedule.timesPerWeekSuffix")}
          </span>
        </div>
      )}

      {preset === "interval" && value.type === "interval" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("habits.schedule.every")}</span>
          <Input
            type="number"
            min={1}
            className="w-20"
            value={value.everyNDays}
            onChange={(e) =>
              onChange({ type: "interval", everyNDays: Number(e.target.value) || 1 })
            }
          />
          <span className="text-sm text-muted-foreground">{t("habits.schedule.days")}</span>
        </div>
      )}
    </div>
  );
}
