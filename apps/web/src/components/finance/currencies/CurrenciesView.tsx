import { useMutation, useQuery } from "@apollo/client/react";
import { ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { Input } from "#components/ui/input";
import {
  ADD_CURRENCY_MUTATION,
  CURRENCIES_REFETCH,
  CURRENCY_SETTINGS_QUERY,
  REFRESH_RATES_MUTATION,
  REMOVE_CURRENCY_MUTATION,
  SET_MAIN_CURRENCY_MUTATION,
  SET_RATE_OVERRIDE_MUTATION,
} from "#graphql/finance";
import type { CurrencySetting, CurrencySettingsData } from "#graphql/types";
import { formatShortDate } from "#lib/dates";
import {
  allCurrencyCodes,
  currencyName,
  currencySymbol,
  decimalSeparator,
  formatRate,
  parseRateInput,
} from "#lib/money";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * The currencies the user works in, which one totals are shown in, and the
 * exchange rates between them: fetched daily, overridable per currency.
 */
export function CurrenciesView() {
  const { t } = useTranslation();
  const { data, error } = useQuery<CurrencySettingsData>(CURRENCY_SETTINGS_QUERY);
  const options = { refetchQueries: CURRENCIES_REFETCH, awaitRefetchQueries: true };
  const [addCurrency, adding] = useMutation(ADD_CURRENCY_MUTATION, options);
  const [removeCurrency] = useMutation(REMOVE_CURRENCY_MUTATION, options);
  const [setMain, settingMain] = useMutation(SET_MAIN_CURRENCY_MUTATION, options);
  const [refreshRates, refreshing] = useMutation<{ refreshExchangeRates: { currencies: number } }>(
    REFRESH_RATES_MUTATION,
    options,
  );
  const [pendingMain, setPendingMain] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState("");

  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) return null;

  const { currencies, rates } = data.currencySettings;
  const main = currencies.find((c) => c.isMain)?.code ?? "GBP";
  const inUse = new Set(currencies.map((c) => c.code));
  const addable = allCurrencyCodes()
    .filter((code) => !inUse.has(code))
    .map((code) => ({ code, name: currencyName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  /** Mutations with no dialog of their own report failures in a toast. */
  function run(action: () => Promise<unknown>) {
    action().catch((err) =>
      toast(err instanceof Error ? err.message : t("common.somethingWentWrong")),
    );
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!toAdd) return;
    run(async () => {
      await addCurrency({ variables: { code: toAdd } });
      setToAdd("");
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <label htmlFor="main-currency" className="text-sm font-medium">
              {t("finance.currencies.main")}
            </label>
            <select
              id="main-currency"
              className={cn(selectClass, "max-w-sm")}
              value={pendingMain ?? main}
              disabled={settingMain.loading}
              onChange={(e) => setPendingMain(e.target.value === main ? null : e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {currencyName(c.code)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("finance.currencies.mainHint")}</p>
            {pendingMain && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm">
                <p className="min-w-0 flex-1">
                  {t("finance.currencies.makeMainConfirm", { code: pendingMain, old: main })}
                </p>
                <Button variant="outline" size="sm" onClick={() => setPendingMain(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={settingMain.loading}
                  onClick={() =>
                    run(async () => {
                      await setMain({ variables: { code: pendingMain } });
                      setPendingMain(null);
                    })
                  }
                >
                  {t("finance.currencies.confirm")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="in-use" className="flex flex-col gap-2">
          <h2
            id="in-use"
            className="px-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("finance.currencies.inUse")}
          </h2>
          <Card>
            <ul className="divide-y">
              {currencies.map((currency) => (
                <CurrencyRow
                  key={currency.code}
                  currency={currency}
                  main={main}
                  onRemove={() => run(() => removeCurrency({ variables: { code: currency.code } }))}
                />
              ))}
            </ul>
          </Card>
        </section>

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-60 flex-1 flex-col gap-2 sm:max-w-sm">
            <label htmlFor="add-currency" className="text-sm font-medium">
              {t("finance.currencies.add")}
            </label>
            <select
              id="add-currency"
              className={selectClass}
              value={toAdd}
              onChange={(e) => setToAdd(e.target.value)}
            >
              <option value="" disabled>
                {t("common.choose")}
              </option>
              {addable.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!toAdd || adding.loading}>
            <Plus className="size-4" /> {t("finance.currencies.addButton")}
          </Button>
        </form>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 text-sm">
            {rates ? (
              <>
                <p className="font-medium">
                  {t("finance.currencies.ratesUpdated", { date: formatShortDate(rates.date) })}
                </p>
                <a
                  href={rates.attribution.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {rates.attribution.label}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </>
            ) : (
              <p className="text-muted-foreground">{t("finance.currencies.ratesNever")}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={refreshing.loading}
              onClick={() =>
                run(async () => {
                  const result = await refreshRates();
                  toast(
                    t("finance.currencies.refreshed", {
                      count: result.data?.refreshExchangeRates.currencies ?? 0,
                    }),
                  );
                })
              }
            >
              <RefreshCw className={cn("size-3.5", refreshing.loading && "animate-spin")} />
              {t("finance.currencies.refresh")}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/** One currency: its rate to the main one (both ways), an override editor, and remove. */
function CurrencyRow({
  currency,
  main,
  onRemove,
}: {
  currency: CurrencySetting;
  main: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setOverride, saving] = useMutation(SET_RATE_OVERRIDE_MUTATION, {
    refetchQueries: CURRENCIES_REFETCH,
    awaitRefetchQueries: true,
  });

  const { code, isMain, rateToMain, overrideToMain, marketRateToMain, accountCount } = currency;
  const removeBlocked = isMain
    ? t("finance.currencies.cantRemoveMain")
    : accountCount > 0
      ? t("finance.currencies.cantRemoveUsed")
      : null;

  function startEditing() {
    // Ungrouped (formatRate would write 34305 as "34.305" in Vietnamese,
    // which reads back as a decimal), 6 significant digits.
    setValue(
      rateToMain ? String(Number(rateToMain.toPrecision(6))).replace(".", decimalSeparator()) : "",
    );
    setError(null);
    setEditing(true);
  }

  async function save(rate: number | null) {
    try {
      await setOverride({ variables: { code, rateToMain: rate } });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const rate = parseRateInput(value);
    if (rate === null) return setError(t("finance.currencies.invalidRate"));
    void save(rate);
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold">
          {code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{currencyName(code)}</span>
            <span className="text-muted-foreground">{currencySymbol(code)}</span>
            {isMain && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                {t("finance.currencies.mainBadge")}
              </span>
            )}
            {overrideToMain !== null && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400">
                {t("finance.currencies.yourRate")}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("finance.currencies.accounts", { count: accountCount })}
          </p>
        </div>

        {!isMain && (
          <div className="text-right text-xs tabular-nums">
            {rateToMain ? (
              <>
                <p className="font-medium">
                  {t("finance.currencies.rateLine", { code, rate: formatRate(rateToMain), main })}
                </p>
                <p className="text-muted-foreground">
                  {t("finance.currencies.inverseLine", {
                    code,
                    rate: formatRate(1 / rateToMain),
                    main,
                  })}
                </p>
              </>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">{t("finance.currencies.noRate")}</p>
            )}
          </div>
        )}

        <div className="flex gap-1">
          {!isMain && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("finance.currencies.editRate", { code })}
              title={t("finance.currencies.editRate", { code })}
              onClick={startEditing}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("finance.currencies.remove", { code })}
            title={removeBlocked ?? t("finance.currencies.remove", { code })}
            disabled={removeBlocked !== null}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="ml-15 flex flex-wrap items-end gap-2" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor={`rate-${code}`} className="text-xs text-muted-foreground">
              {t("finance.currencies.rateInput", { code, main })}
            </label>
            <Input
              id={`rate-${code}`}
              inputMode="decimal"
              autoFocus
              className="w-40 tabular-nums"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={saving.loading}>
            {t("finance.currencies.saveRate")}
          </Button>
          {overrideToMain !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving.loading}
              onClick={() => save(null)}
            >
              {t("finance.currencies.useMarketRate")}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </Button>
          {marketRateToMain !== null && (
            <p className="w-full text-xs text-muted-foreground">
              {t("finance.currencies.marketRate", { rate: formatRate(marketRateToMain) })}
            </p>
          )}
          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
