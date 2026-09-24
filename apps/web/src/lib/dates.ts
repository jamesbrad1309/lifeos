/**
 * Local-calendar date helpers for the journal. Unlike `toISOString()`, these
 * use the user's own day boundary — an entry written at 23:30 belongs to
 * today, not to tomorrow in UTC.
 */

/** Date → "YYYY-MM-DD" in local time. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → local-midnight Date. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const offset = (fromIsoDate(iso).getDay() + 6) % 7;
  return addDays(iso, -offset);
}

/** Current local time as "HH:mm". */
export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** "Today", "Yesterday", or e.g. "Monday, 21 September". */
export function formatDayHeading(iso: string): string {
  const today = todayIsoDate();
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return fromIsoDate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** 90 → "1h 30m", 20 → "20m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
