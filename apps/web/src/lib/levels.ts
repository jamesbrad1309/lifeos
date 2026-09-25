import type { TFunction } from "i18next";

/**
 * A level's title in the app's language. The API also sends `levelTitle`,
 * but in English only; the level number is what the translation keys on.
 */
export function levelTitle(t: TFunction, level: number): string {
  const titles = t("shell.level.titles", { returnObjects: true });
  return titles[Math.min(Math.max(level, 1), titles.length) - 1];
}
