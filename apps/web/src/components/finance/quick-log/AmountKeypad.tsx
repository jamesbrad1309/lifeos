import { Delete } from "lucide-react";
import { useTranslation } from "react-i18next";

import { decimalSeparator } from "#lib/money";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

/**
 * On-screen keypad for touch devices, so the phone keyboard doesn't slide
 * up and cover the category chips.
 */
export function AmountKeypad({ onKey }: { onKey: (key: string) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid grid-cols-3 gap-1.5">
      <legend className="sr-only">{t("finance.quickLog.keypad")}</legend>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key === "." ? decimalSeparator() : key)}
          aria-label={
            key === "⌫"
              ? t("finance.quickLog.keypadDelete")
              : key === "."
                ? t("finance.quickLog.keypadDecimal")
                : key
          }
          className="flex h-12 items-center justify-center rounded-lg bg-muted text-lg font-medium tabular-nums transition-colors active:bg-accent"
        >
          {key === "⌫" ? <Delete className="size-5" /> : key === "." ? decimalSeparator() : key}
        </button>
      ))}
    </fieldset>
  );
}

/** Applies a keypad key to the typed amount, allowing at most two decimals. */
export function applyKey(amount: string, key: string): string {
  if (key === "⌫") return amount.slice(0, -1);
  if (key === "." || key === ",") return /[.,]/.test(amount) ? amount : `${amount || "0"}${key}`;
  if (/[.,]\d{2}$/.test(amount)) return amount;
  if (amount === "0") return key;
  return amount + key;
}
