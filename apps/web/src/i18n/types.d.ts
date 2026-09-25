import type { en } from "#i18n/en/index";

// Makes `t("…")` keys type-checked against the English dictionary.
declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
