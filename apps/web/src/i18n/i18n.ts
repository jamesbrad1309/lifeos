import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "#i18n/en/index";
import { setLocale } from "#i18n/locale";
import { vi } from "#i18n/vi/index";

/** The languages LifeOS speaks, and the Intl locale each formats numbers and dates with. */
export const LANGUAGES = {
  en: { label: "English", short: "EN", locale: "en-GB" },
  vi: { label: "Tiếng Việt", short: "VI", locale: "vi-VN" },
} as const;

export type Language = keyof typeof LANGUAGES;

const STORAGE_KEY = "lifeos.language";

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
}

/** The saved choice, else the browser's preferred language, else English. */
function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage blocked (private window): fall through to the browser language.
  }
  const preferred = navigator.languages.map((l) => l.slice(0, 2).toLowerCase());
  return preferred.find(isLanguage) ?? "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: initialLanguage(),
  fallbackLng: "en",
  // React escapes output already.
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;
setLocale(currentLocale());
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
  setLocale(currentLocale());
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered across visits; still switches now.
  }
});

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : "en";
}

/**
 * The Intl locale for the chosen language. `lib/money.ts` and `lib/dates.ts`
 * format with it, so "£1,204.33" becomes "1.204,33 £" in Vietnamese.
 */
export function currentLocale(): string {
  return LANGUAGES[currentLanguage()].locale;
}

export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
}

export { i18n };
