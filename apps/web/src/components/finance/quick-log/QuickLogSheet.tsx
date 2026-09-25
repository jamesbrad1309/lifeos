import { useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Amount, MONEY_IN_CLASS, MONEY_OUT_CLASS } from "#components/finance/Amount";
import { AmountKeypad, applyKey } from "#components/finance/quick-log/AmountKeypad";
import { Button } from "#components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import {
  CATEGORIES_QUERY,
  CREATE_QUICK_PRESET_MUTATION,
  DELETE_QUICK_PRESET_MUTATION,
  DELETE_TRANSACTION_MUTATION,
  DISMISS_PRESET_SUGGESTION_MUTATION,
  QUICK_LOG_CONTEXT_QUERY,
  QUICK_LOG_MUTATION,
  TODAY_LOGS_QUERY,
  TRANSACTIONS_REFETCH,
} from "#graphql/finance";
import type {
  Category,
  QuickLogContext,
  QuickLogData,
  QuickPreset,
  Transaction,
} from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { useCurrencies } from "#hooks/useCurrencies";
import { closeQuickLog, useQuickLogState } from "#hooks/useQuickLog";
import { useStoredState } from "#hooks/useStoredState";
import { addDays, todayIsoDate } from "#lib/dates";
import {
  currencySymbol,
  formatMoney,
  moneyPlaceholder,
  parseMoneyInput,
  toMoneyInput,
} from "#lib/money";
import { parseQuickLog } from "#lib/quick-log-parse";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

/** The user's local time, for ranking chips (see QuickLogService.context). */
function localTimeVariables() {
  const now = new Date();
  return {
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    utcOffsetMinutes: now.getTimezoneOffset(),
  };
}

const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Mounted once in the app shell; opened with `openQuickLog()`. */
export function QuickLogSheet() {
  const { open, prefill, session } = useQuickLogState();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeQuickLog()}>
      <DialogContent
        aria-describedby="quick-log-hint"
        // Start in the amount, not on the first control (the account pill).
        onOpenAutoFocus={(e) => {
          const amount = document.querySelector<HTMLInputElement>("[data-quick-log-amount]");
          if (amount) {
            e.preventDefault();
            amount.focus();
          }
        }}
        className="gap-0 p-0 sm:max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92svh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        {/* Keyed by session: every open starts from a clean slate and a new clientId. */}
        <QuickLogForm key={session} prefill={prefill} />
      </DialogContent>
    </Dialog>
  );
}

function QuickLogForm({ prefill }: { prefill: ReturnType<typeof useQuickLogState>["prefill"] }) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const variables = useMemo(localTimeVariables, []);
  const { data, error: contextError } = useQuery<{ quickLogContext: QuickLogContext }>(
    QUICK_LOG_CONTEXT_QUERY,
    {
      variables,
      fetchPolicy: "cache-and-network",
    },
  );
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const context = data?.quickLogContext;
  const categories = categoriesData?.categories ?? [];

  const [touch] = useState(isTouch);
  const [amount, setAmount] = useState(() => prefill?.amount ?? "");
  const [text, setText] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  /** Null = automatic: the parser's @account, the category's last account, or the default. */
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIsoDate);
  const [showAll, setShowAll] = useState(false);
  const [editingPresets, setEditingPresets] = useState(false);
  /** Set by an amount-less preset or a deep link: the next save uses it. */
  const [chosenCategoryId, setChosenCategoryId] = useState<string | null>(null);
  const [catchUp, setCatchUp] = useStoredState("lifeos.quickLog.catchUp", false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [openedAt, setOpenedAt] = useState(() => performance.now());
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const [quickLog] = useMutation<QuickLogData>(QUICK_LOG_MUTATION, {
    refetchQueries: TRANSACTIONS_REFETCH,
  });
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION_MUTATION, {
    refetchQueries: TRANSACTIONS_REFETCH,
  });
  const [createPreset] = useMutation(CREATE_QUICK_PRESET_MUTATION, {
    refetchQueries: ["QuickLogContext"],
  });
  const [deletePreset] = useMutation(DELETE_QUICK_PRESET_MUTATION, {
    refetchQueries: ["QuickLogContext"],
  });
  const [dismissSuggestion] = useMutation(DISMISS_PRESET_SUGGESTION_MUTATION);

  // A deep link names its category ("coffee"): match it once categories load.
  const [prefillApplied, setPrefillApplied] = useState(!prefill?.category);
  if (!prefillApplied && categories.length > 0 && prefill?.category) {
    setPrefillApplied(true);
    const wanted = prefill.category.toLocaleLowerCase();
    const match = categories.find(
      (c) =>
        c.name.toLocaleLowerCase() === wanted ||
        categoryName(c).toLocaleLowerCase() === wanted ||
        c.aliases.includes(wanted),
    );
    if (match) setChosenCategoryId(match.id);
  }

  const accounts = context?.accounts ?? [];
  const defaultAccountId = context?.defaultAccount?.id ?? null;
  const multiCurrency = new Set(accounts.map((a) => a.currency)).size > 1;
  const currencyOf = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.currency;
  // Only decides how many decimals an amount in the text line has.
  const parseCurrency = currencyOf(accountId ?? defaultAccountId) ?? "GBP";
  const parsed = useMemo(
    () =>
      parseQuickLog(text, {
        // The translated name ("Cà phê") is matched as well as the stored one.
        categories: categories.map((c) => ({ ...c, aliases: [...c.aliases, categoryName(c)] })),
        presets: context?.presets ?? [],
        accounts,
        payees: (context?.recentPayees ?? []).map((p) => ({
          payee: p.payee,
          categoryId: p.category?.id ?? null,
        })),
        currency: parseCurrency,
      }),
    [text, categories, context, accounts, parseCurrency, categoryName],
  );

  const hintedCategoryId = chosenCategoryId ?? parsed.categoryId;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hinted = hintedCategoryId ? byId.get(hintedCategoryId) : undefined;
  /**
   * The account a save will go to (as far as we know before a chip is
   * tapped), and so the currency the amount is typed in: the account pill,
   * an @account in the text, the hinted category's usual account, or the
   * default.
   */
  const shownAccountId =
    accountId ??
    parsed.accountId ??
    (hintedCategoryId ? context?.lastAccountByCategory[hintedCategoryId] : undefined) ??
    defaultAccountId;
  const currency = currencyOf(shownAccountId) ?? "GBP";
  const typedAmount = parseMoneyInput(amount, currency);
  const amountMinor = typedAmount ?? parsed.amountMinor;
  const income = isIncome || hinted?.kind === "income";

  const chips = income
    ? categories.filter((c) => c.kind === "income")
    : showAll
      ? categories.filter((c) => c.kind === "expense")
      : (context?.suggestedCategories ?? []);

  function resolveAccount(categoryId: string | null, preset?: QuickPreset): string | null {
    const candidate =
      accountId ??
      parsed.accountId ??
      preset?.account?.id ??
      (categoryId ? context?.lastAccountByCategory[categoryId] : undefined) ??
      null;
    // An amount the user typed is in the currency shown; never let a chip's
    // usual account move it into an account in another currency.
    const usesPresetAmount = preset?.amountMinor != null && typedAmount === null;
    if (!usesPresetAmount && currencyOf(candidate ?? defaultAccountId) !== currency) {
      return shownAccountId;
    }
    return candidate;
  }

  /** Clears the form for the next entry (catch-up mode) with a fresh clientId. */
  function reset() {
    setAmount("");
    setText("");
    setIsIncome(false);
    setChosenCategoryId(null);
    setError(null);
    setClientId(crypto.randomUUID());
    setOpenedAt(performance.now());
    amountRef.current?.focus();
  }

  async function save(categoryId: string | null, preset?: QuickPreset) {
    const minor =
      preset?.amountMinor != null && typedAmount === null ? preset.amountMinor : amountMinor;
    if (!minor) {
      setError(t("finance.quickLog.typeAmountFirst"));
      if (preset) setChosenCategoryId(preset.category.id);
      amountRef.current?.focus();
      return;
    }
    const category = categoryId ? byId.get(categoryId) : undefined;
    setSaving(true);
    setError(null);
    try {
      const { data: result } = await quickLog({
        variables: {
          input: {
            clientId,
            amountMinor: minor,
            isIncome: isIncome || category?.kind === "income",
            categoryId,
            accountId: resolveAccount(categoryId, preset),
            date,
            payee: preset?.payee ?? parsed.payee,
            note: preset ? null : parsed.note,
            presetId: preset?.id ?? parsed.presetId,
            durationMs: Math.round(performance.now() - openedAt),
          },
        },
      });
      if (!result) return;
      announce(result.quickLog, category);
      if (catchUp) reset();
      else closeQuickLog();
    } catch (err) {
      // Same clientId on retry, so a save that actually went through isn't doubled.
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    } finally {
      setSaving(false);
    }
  }

  /** "£3.40 Coffee logged · Undo", then "Save as preset?" when it's a regular. */
  function announce(result: QuickLogData["quickLog"], category: Category | undefined) {
    const tx = result.transaction;
    const amount = formatMoney(Math.abs(tx.amountMinor), tx.account.currency);
    const what = category
      ? `${category.icon ?? ""} ${categoryName(category)}`.trim()
      : t("finance.quickLog.loggedToReview");
    toast(t("finance.quickLog.logged", { amount, what }), {
      actions: [
        { label: t("common.undo"), onClick: () => deleteTransaction({ variables: { id: tx.id } }) },
      ],
    });

    if (result.suggestPreset && category && result.presetKey) {
      const label = tx.payee ?? tx.note ?? categoryName(category);
      const key = result.presetKey;
      toast(t("finance.quickLog.savePreset", { label, amount }), {
        durationMs: 8000,
        actions: [
          {
            label: t("finance.quickLog.savePresetAction"),
            onClick: () =>
              createPreset({
                variables: {
                  input: {
                    label,
                    amountMinor: Math.abs(tx.amountMinor),
                    categoryId: category.id,
                    payee: tx.payee,
                  },
                },
              }),
          },
        ],
        onExpire: () => dismissSuggestion({ variables: { categoryId: category.id, key } }),
      });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // ↵ with no category → the "To review" inbox, for logging in a rush.
    void save(hintedCategoryId ?? null);
  }

  if (contextError && !context) {
    return <p className="p-6 text-sm text-destructive">{contextError.message}</p>;
  }
  if (context && accounts.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <DialogTitle>{t("finance.quickLog.title")}</DialogTitle>
        <DialogDescription id="quick-log-hint">
          {t("finance.quickLog.setUpFirst")}
        </DialogDescription>
        <Button asChild>
          <Link to="/finance/accounts" onClick={closeQuickLog}>
            {t("finance.quickLog.setUpAccounts")}
          </Link>
        </Button>
      </div>
    );
  }

  const placeholder = parsed.amountMinor
    ? toMoneyInput(parsed.amountMinor, currency)
    : moneyPlaceholder(currency);
  const defaultAccountName = accounts.find((a) => a.id === context?.defaultAccount?.id)?.name;
  const yesterday = addDays(todayIsoDate(), -1);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:p-5" noValidate>
      <DialogTitle className="sr-only">{t("finance.quickLog.title")}</DialogTitle>
      <p id="quick-log-hint" className="sr-only">
        {t("finance.quickLog.hint")}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 pr-8">
        <select
          aria-label={t("finance.quickLog.account")}
          value={accountId ?? ""}
          onChange={(e) => setAccountId(e.target.value || null)}
          className="h-8 max-w-44 truncate rounded-full border bg-background px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {parsed.accountId
              ? t("finance.quickLog.viaParser", {
                  name: accounts.find((a) => a.id === parsed.accountId)?.name,
                })
              : t("finance.quickLog.auto", {
                  name: defaultAccountName ?? t("finance.quickLog.autoDefault"),
                })}
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.last4 ? ` ··${a.last4}` : ""}
              {multiCurrency ? ` · ${a.currency}` : ""}
            </option>
          ))}
        </select>
        <div className="flex h-8 items-center rounded-full border p-0.5 text-xs font-medium">
          {[
            { value: todayIsoDate(), label: t("common.today") },
            { value: yesterday, label: t("common.yesterday") },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={date === option.value}
              onClick={() => setDate(option.value)}
              className={cn(
                "h-full rounded-full px-2.5",
                date === option.value ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
          <input
            type="date"
            aria-label={t("finance.quickLog.anotherDate")}
            value={date}
            max={todayIsoDate()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={cn(
              "h-full w-8 rounded-full bg-transparent px-1 text-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:opacity-60",
              date < yesterday && "w-auto text-foreground",
            )}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <label className="flex items-baseline gap-1 text-4xl font-semibold tracking-tight tabular-nums">
          <span className={income ? MONEY_IN_CLASS : MONEY_OUT_CLASS}>
            {income ? "+" : "−"}
            {currencySymbol(currency)}
          </span>
          <input
            ref={amountRef}
            data-quick-log-amount
            readOnly={touch}
            inputMode="decimal"
            autoComplete="off"
            aria-label={t("finance.quickLog.amount")}
            placeholder={placeholder}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            // Grows with what's shown: the typed amount, or the one parsed from the text.
            size={Math.max(4, (amount || placeholder).length + 1)}
            className="w-auto min-w-0 bg-transparent text-center outline-none placeholder:text-muted-foreground/50"
          />
        </label>
        <button
          type="button"
          onClick={() => setIsIncome(!isIncome)}
          aria-pressed={isIncome}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            isIncome
              ? cn("bg-emerald-500/15", MONEY_IN_CLASS)
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {isIncome ? t("finance.quickLog.income") : t("finance.quickLog.addIncome")}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Input
          aria-label={t("finance.quickLog.whatWasItLabel")}
          placeholder={t("finance.quickLog.whatWasIt")}
          value={text}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <p className="min-h-4 px-1 text-xs text-muted-foreground" aria-live="polite">
          {hinted &&
            (parsed.matchedBy === "payee" && !chosenCategoryId
              ? t("finance.quickLog.likeLastTime", {
                  category: `${hinted.icon ?? ""} ${categoryName(hinted)}`.trim(),
                })
              : t("finance.quickLog.matched", {
                  category: `${hinted.icon ?? ""} ${categoryName(hinted)}`.trim(),
                }))}
          {!hinted && amountMinor ? t("finance.quickLog.enterToReview") : null}
        </p>
      </div>

      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">{t("finance.quickLog.saveToCategory")}</legend>
        {chips.map((category) => (
          <button
            key={category.id}
            type="button"
            disabled={saving}
            onClick={() => save(category.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-accent disabled:opacity-60",
              category.id === hintedCategoryId &&
                "border-primary bg-primary/10 ring-1 ring-primary",
            )}
          >
            <span aria-hidden>{category.icon}</span>
            {categoryName(category)}
          </button>
        ))}
        {!income && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            {showAll ? (
              <>
                {t("finance.quickLog.fewer")} <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                {t("finance.quickLog.more")} <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        )}
      </fieldset>

      {!income && (context?.presets.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3" /> {t("finance.quickLog.presets")}
            </p>
            <button
              type="button"
              onClick={() => setEditingPresets(!editingPresets)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {editingPresets ? t("finance.quickLog.done") : t("common.edit")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {context?.presets.map((preset) => (
              <span key={preset.id} className="flex items-center">
                <button
                  type="button"
                  disabled={saving || editingPresets}
                  onClick={() => save(preset.category.id, preset)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-sm transition-colors hover:bg-accent disabled:opacity-80"
                >
                  <span aria-hidden>{preset.emoji ?? preset.category.icon}</span>
                  {preset.label}
                  {preset.amountMinor != null && (
                    <span className="text-muted-foreground tabular-nums">
                      {formatMoney(
                        preset.amountMinor,
                        currencyOf(preset.account?.id ?? defaultAccountId) ?? currency,
                      )}
                    </span>
                  )}
                </button>
                {editingPresets && (
                  <button
                    type="button"
                    aria-label={t("finance.quickLog.deletePreset", { label: preset.label })}
                    onClick={() => deletePreset({ variables: { id: preset.id } })}
                    className="-ml-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {touch && <AmountKeypad onKey={(key) => setAmount((a) => applyKey(a, key))} />}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={catchUp}
            onChange={(e) => setCatchUp(e.target.checked)}
            className="accent-primary"
          />
          {t("finance.quickLog.logSeveral")}
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={saving || !amountMinor}>
          {hinted
            ? t("finance.quickLog.saveTo", { category: categoryName(hinted) })
            : t("finance.quickLog.saveForLater")}
        </Button>
      </div>

      {catchUp && <TodayLogs />}
    </form>
  );
}

/** Catch-up mode: what's been logged today, under the sheet. */
function TodayLogs() {
  const { t } = useTranslation();
  const { main, toMain } = useCurrencies();
  const categoryName = useCategoryName();
  const today = todayIsoDate();
  const { data } = useQuery<{ todayLogs: { items: Transaction[] } }>(TODAY_LOGS_QUERY, {
    variables: { filter: { from: today, to: today, includeTransfers: false } },
  });
  const items = data?.todayLogs.items ?? [];
  if (items.length === 0) return null;
  const total = items.reduce(
    (sum, tx) =>
      sum + (tx.amountMinor < 0 ? (toMain(-tx.amountMinor, tx.account.currency) ?? 0) : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>{t("finance.quickLog.today")}</span>
        <span className="tabular-nums">
          {t("finance.quickLog.spentToday", {
            amount: formatMoney(total, main),
          })}
        </span>
      </p>
      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
        {items.map((tx) => (
          <li key={tx.id} className="flex items-center gap-2">
            <span aria-hidden className="w-5 text-center">
              {tx.category?.icon ?? "•"}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {tx.payee ??
                tx.note ??
                (tx.category ? categoryName(tx.category) : t("finance.toReview"))}
            </span>
            <Amount
              minor={tx.amountMinor}
              currency={tx.account.currency}
              tone={tx.isTransfer ? "neutral" : "auto"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
