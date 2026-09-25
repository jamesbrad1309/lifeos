import { useQuery } from "@apollo/client/react";
import { CURRENCY_SETTINGS_QUERY } from "#graphql/finance";
import type { CurrencySetting, CurrencySettingsData } from "#graphql/types";
import { currencyDigits } from "#lib/money";

export interface Currencies {
  /** The main currency's ISO code (what totals are shown in). */
  main: string;
  /** In use, main first. */
  list: CurrencySetting[];
  /**
   * Minor units of `code` → minor units of the main currency at today's
   * rate, for totals the client adds up itself (a day's spending). Null
   * without a rate. Server reports convert on the server, month by month.
   */
  toMain: (amountMinor: number, code: string) => number | null;
}

/** The user's currencies and a converter; one small cached query shared app-wide. */
export function useCurrencies(): Currencies {
  const { data } = useQuery<CurrencySettingsData>(CURRENCY_SETTINGS_QUERY);
  const list = data?.currencySettings.currencies ?? [];
  const main = list.find((c) => c.isMain)?.code ?? "GBP";
  const rates = new Map(list.map((c) => [c.code, c.rateToMain]));
  return {
    main,
    list,
    toMain: (amountMinor, code) => {
      if (code === main) return amountMinor;
      const rate = rates.get(code);
      if (!rate) return null;
      const major = amountMinor / 10 ** currencyDigits(code);
      return Math.round(major * rate * 10 ** currencyDigits(main));
    },
  };
}
