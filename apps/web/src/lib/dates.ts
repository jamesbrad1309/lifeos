import { getLocale } from "#i18n/locale";

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

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1);

/** "Today", "Yesterday", or e.g. "Monday, 21 September", in the app's language. */
export function formatDayHeading(iso: string): string {
  const offset = daysBetween(todayIsoDate(), iso);
  if (offset === 0 || offset === -1) {
    const relative = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });
    return capitalize(relative.format(offset, "day"));
  }
  return fromIsoDate(iso).toLocaleDateString(getLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** 90 → "1h 30m" (Vietnamese: "1 giờ 30 phút"), 20 → "20m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const [hours, mins] = getLocale().startsWith("vi") ? [" giờ", " phút"] : ["h", "m"];
  if (h === 0) return `${m}${mins}`;
  return m === 0 ? `${h}${hours}` : `${h}${hours} ${m}${mins}`;
}

/** Whole calendar days from `from` to `to` (both "YYYY-MM-DD"); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / 86_400_000);
}

/** "YYYY-MM-DD" → "8 Oct" (year added when it isn't this year). */
export function formatShortDate(iso: string): string {
  const date = fromIsoDate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "YYYY-MM" → "Mar 2029" ("thg 3, 2029"). */
export function formatMonth(yearMonth: string): string {
  return fromIsoDate(`${yearMonth}-01`).toLocaleDateString(getLocale(), {
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM" → "March" ("tháng 3"). */
export function formatMonthName(yearMonth: string): string {
  return fromIsoDate(`${yearMonth}-01`).toLocaleDateString(getLocale(), { month: "long" });
}

/** A date → "Mon" / "Monday" ("T2" / "Thứ Hai"). */
export function formatWeekday(date: Date, style: "short" | "long" = "short"): string {
  return date.toLocaleDateString(getLocale(), { weekday: style });
}

/** A date → "Monday, 21 September", for labels. */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(getLocale(), { weekday: "long", day: "numeric", month: "long" });
}

/** An ISO timestamp → "today", "yesterday", "3 days ago", in local days. */
export function formatDaysAgo(timestamp: string): string {
  const days = daysBetween(toIsoDate(new Date(timestamp)), todayIsoDate());
  return new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" }).format(-days, "day");
}

/** A day of the month: 18 → "18th" in English; Vietnamese uses the plain number ("ngày 18"). */
export function ordinal(n: number): string {
  if (!getLocale().startsWith("en")) return String(n);
  const suffix = new Intl.PluralRules("en", { type: "ordinal" }).select(n);
  return `${n}${{ one: "st", two: "nd", few: "rd" }[suffix as string] ?? "th"}`;
}

/** This month as "YYYY-MM", local time. */
export function currentMonth(): string {
  return todayIsoDate().slice(0, 7);
}

/** "2026-09" + 1 → "2026-10". */
export function addMonths(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return toIsoDate(date).slice(0, 7);
}

/** "2026-09" → { from: "2026-09-01", to: "2026-09-30" }. */
export function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  return { from: `${yearMonth}-01`, to: toIsoDate(new Date(y, m, 0)) };
}
