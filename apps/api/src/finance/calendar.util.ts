/**
 * Calendar-day helpers for `@db.Date` columns. Prisma reads a DATE as UTC
 * midnight, so everything here uses UTC getters: "2026-09-25" stays the
 * 25th whatever the server's time zone is.
 */

/** "YYYY-MM-DD" → the Date Prisma stores for that day. */
export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `day` (1–31) in the given month, clamped to its length: the 31st of February is the 28th/29th. */
export function dayInMonth(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))));
}

/** The first date on or after `from` that falls on `day` (1–31, clamped per month). */
export function nextDayOfMonth(from: Date, day: number): Date {
  const thisMonth = dayInMonth(from.getUTCFullYear(), from.getUTCMonth(), day);
  if (thisMonth >= from) return thisMonth;
  return dayInMonth(from.getUTCFullYear(), from.getUTCMonth() + 1, day);
}

/** The last date on or before `from` that falls on `day` (1–31, clamped per month). */
export function previousDayOfMonth(from: Date, day: number): Date {
  const thisMonth = dayInMonth(from.getUTCFullYear(), from.getUTCMonth(), day);
  if (thisMonth <= from) return thisMonth;
  return dayInMonth(from.getUTCFullYear(), from.getUTCMonth() - 1, day);
}

/** "YYYY-MM" of the month `months` after `from`'s. */
export function monthAfter(from: Date, months: number): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  return toIsoDate(date).slice(0, 7);
}
