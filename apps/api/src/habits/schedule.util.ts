// Prisma stores `Habit.schedule` as a plain Json column (see prisma/schema.prisma) —
// this discriminated union is the shape application code actually reads/writes.
export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekly"; daysOfWeek: number[] }
  | { type: "timesPerWeek"; count: number }
  | { type: "interval"; everyNDays: number };

/** Days since the Unix epoch, for stable "every N days" interval math. */
function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

export function isDueOn(schedule: HabitSchedule, date: Date): boolean {
  switch (schedule.type) {
    case "daily":
      return true;
    case "weekly":
      return schedule.daysOfWeek.includes(date.getDay());
    case "timesPerWeek":
      // Any day is a valid check-in day; the target is evaluated against
      // completed entries for the week, not against a fixed day list.
      return true;
    case "interval":
      return daysSinceEpoch(date) % schedule.everyNDays === 0;
  }
}
