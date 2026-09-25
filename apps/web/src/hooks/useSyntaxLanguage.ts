import { useTranslation } from "react-i18next";
import type { SyntaxLanguage } from "#lib/journal-syntax";

/** The language the journal's slash commands and emotion words are written in. */
export function useSyntaxLanguage(): SyntaxLanguage {
  const { i18n } = useTranslation();
  return i18n.language === "vi" ? "vi" : "en";
}
