import type { HabitSchedule } from "#graphql/types";

/**
 * Mirrors apps/api/src/habits/schedule.util.ts exactly — kept for the day
 * view's "is this habit due today" filter, which has no reason to round-trip
 * to the server just to answer a question the client already has the data
 * (schedule + today's date) to answer itself.
 */
export function isDueOn(schedule: HabitSchedule, date: Date): boolean {
  switch (schedule.type) {
    case "daily":
      return true;
    case "weekly":
      return schedule.daysOfWeek.includes(date.getDay());
    case "timesPerWeek":
      return true;
    case "interval": {
      const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000);
      return daysSinceEpoch % schedule.everyNDays === 0;
    }
  }
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
