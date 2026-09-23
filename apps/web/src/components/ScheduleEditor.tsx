import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { HabitSchedule } from "#graphql/types";
import { cn } from "#lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const PRESET_OPTIONS: { value: Preset; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "weekends", label: "Weekends (Sat–Sun)" },
  { value: "custom", label: "Custom days" },
  { value: "timesPerWeek", label: "X times a week" },
  { value: "interval", label: "Every N days" },
];

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: HabitSchedule;
  onChange: (schedule: HabitSchedule) => void;
}) {
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
      <Label htmlFor="schedule-preset">Schedule</Label>
      <select
        id="schedule-preset"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value as Preset)}
      >
        {PRESET_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {preset === "custom" && value.type === "weekly" && (
        <div className="flex gap-1">
          {DAY_LABELS.map((label, day) => {
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
          <span className="text-sm text-muted-foreground">times per week</span>
        </div>
      )}

      {preset === "interval" && value.type === "interval" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            type="number"
            min={1}
            className="w-20"
            value={value.everyNDays}
            onChange={(e) =>
              onChange({ type: "interval", everyNDays: Number(e.target.value) || 1 })
            }
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}
    </div>
  );
}
