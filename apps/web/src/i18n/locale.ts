/**
 * The Intl locale formatting uses ("en-GB", "vi-VN"). Kept apart from the
 * i18next setup so pure helpers (`lib/money.ts`, `lib/dates.ts`) and their
 * tests don't pull in the browser-only i18n bootstrap; `i18n.ts` keeps it
 * in step with the chosen language.
 */
let locale = "en-GB";

export function getLocale(): string {
  return locale;
}

export function setLocale(next: string): void {
  locale = next;
}
