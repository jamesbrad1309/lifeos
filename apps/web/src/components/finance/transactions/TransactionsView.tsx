import { useMutation, useQuery } from "@apollo/client/react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Inbox,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Amount } from "#components/finance/Amount";
import { CsvImportDialog } from "#components/finance/transactions/CsvImportDialog";
import { TransactionForm } from "#components/finance/transactions/TransactionForm";
import { TransferDialog } from "#components/finance/transactions/TransferDialog";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Input } from "#components/ui/input";
import {
  ACCOUNTS_QUERY,
  CATEGORIES_QUERY,
  DELETE_TRANSACTION_MUTATION,
  TO_REVIEW_COUNT_QUERY,
  TRANSACTIONS_QUERY,
  TRANSACTIONS_REFETCH,
  UPDATE_TRANSACTION_MUTATION,
} from "#graphql/finance";
import type {
  AccountsData,
  Category,
  Transaction,
  TransactionFilter,
  TransactionsData,
} from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { useCurrencies } from "#hooks/useCurrencies";
import { useUndoableDelete } from "#hooks/useUndoableDelete";
import { addMonths, currentMonth, formatDayHeading, formatMonth, monthRange } from "#lib/dates";
import { formatMoney } from "#lib/money";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

export interface TransactionsSearch {
  view: "all" | "review";
  /** "YYYY-MM"; the "all" view shows one month at a time. */
  month?: string;
  account?: string;
  category?: string;
  q?: string;
}

interface Props {
  search: TransactionsSearch;
  /** Updates the URL (the route owns the search params). */
  onSearchChange: (next: Partial<TransactionsSearch>, options?: { replace?: boolean }) => void;
}

export const PAGE_SIZE = 50;

/** The variables TRANSACTIONS_QUERY runs with; the route's loader uses the same ones. */
export function transactionFilter(search: TransactionsSearch): TransactionFilter {
  if (search.view === "review") return { uncategorisedOnly: true };
  const { from, to } = monthRange(search.month ?? currentMonth());
  return {
    from,
    to,
    accountId: search.account ?? null,
    categoryId: search.category ?? null,
    search: search.q ?? null,
  };
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Every transaction, newest first and grouped by day, plus the "To review"
 * inbox where quick logs saved without a category get one, several in a row.
 */
export function TransactionsView({ search, onSearchChange }: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { main, toMain } = useCurrencies();
  const filter = transactionFilter(search);
  const { data, error, loading, fetchMore } = useQuery<TransactionsData>(TRANSACTIONS_QUERY, {
    variables: { filter, first: PAGE_SIZE },
    notifyOnNetworkStatusChange: true,
  });
  const { data: reviewData } = useQuery<{ toReviewCount: number }>(TO_REVIEW_COUNT_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const categories = categoriesData?.categories ?? [];
  const accounts = accountsData?.accounts ?? [];

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastEdited, setLastEdited] = useState<Transaction | null>(null);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION_MUTATION, {
    refetchQueries: TRANSACTIONS_REFETCH,
    awaitRefetchQueries: true,
  });
  const deletes = useUndoableDelete((id) => deleteTransaction({ variables: { id } }));
  const [updateTransaction] = useMutation(UPDATE_TRANSACTION_MUTATION, {
    refetchQueries: TRANSACTIONS_REFETCH,
    awaitRefetchQueries: true,
  });

  function remove(tx: Transaction) {
    deletes.remove(tx.id);
    toast(
      t("finance.transactions.deleted", {
        amount: formatMoney(Math.abs(tx.amountMinor), tx.account.currency),
      }),
      { actions: [{ label: t("common.undo"), onClick: () => deletes.undo(tx.id) }] },
    );
  }

  /**
   * Files an inbox item, then moves focus to the next item's picker, so a
   * backlog can be cleared from the keyboard without reaching for the mouse.
   */
  async function categorise(tx: Transaction, categoryId: string) {
    const pickers = [...document.querySelectorAll<HTMLSelectElement>("select[data-categorise]")];
    const index = pickers.findIndex((el) => el.dataset.categorise === tx.id);
    try {
      await updateTransaction({ variables: { id: tx.id, input: { categoryId } } });
      setRefocus({ index, doneId: tx.id });
    } catch (err) {
      toast(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  const items = (data?.transactions.items ?? []).filter((tx) => !deletes.pending.includes(tx.id));

  // Focus the next picker once the filed item has actually left the list.
  const [refocus, setRefocus] = useState<{ index: number; doneId: string } | null>(null);
  useEffect(() => {
    if (!refocus || items.some((tx) => tx.id === refocus.doneId)) return;
    const pickers = [...document.querySelectorAll<HTMLSelectElement>("select[data-categorise]")];
    (pickers[refocus.index] ?? pickers.at(-1))?.focus();
    setRefocus(null);
  }, [items, refocus]);
  const nextCursor = data?.transactions.nextCursor ?? null;
  const toReview = reviewData?.toReviewCount ?? 0;
  const review = search.view === "review";
  const month = search.month ?? currentMonth();
  const filtered = Boolean(search.account || search.category || search.q);

  // Group by day, keeping the server's newest-first order.
  const days: { date: string; items: Transaction[] }[] = [];
  for (const tx of items) {
    const day = days.at(-1);
    if (day?.date === tx.date) day.items.push(tx);
    else days.push({ date: tx.date, items: [tx] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-sm" role="tablist">
          {[
            { view: "all" as const, label: t("finance.transactions.all") },
            { view: "review" as const, label: t("finance.toReview"), count: toReview },
          ].map((tab) => (
            <button
              key={tab.view}
              type="button"
              role="tab"
              aria-selected={search.view === tab.view}
              onClick={() => onSearchChange({ view: tab.view })}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 font-medium",
                search.view === tab.view
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    search.view === tab.view
                      ? "bg-background/20"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {!review && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.previousMonth")}
              onClick={() => onSearchChange({ month: addMonths(month, -1) })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-20 text-center text-sm font-medium">{formatMonth(month)}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.nextMonth")}
              disabled={month >= currentMonth()}
              onClick={() => onSearchChange({ month: addMonths(month, 1) })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
            <FileUp className="size-4" /> {t("finance.import.button")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTransferring(true)}>
            <ArrowLeftRight className="size-4" /> {t("finance.transfer.title")}
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t("finance.transactions.add")}
          </Button>
        </div>
      </div>

      {!review && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={search.q ?? ""}
            onChange={(q) => onSearchChange({ q: q || undefined }, { replace: true })}
          />
          <select
            aria-label={t("finance.transactions.account")}
            className={selectClass}
            value={search.account ?? ""}
            onChange={(e) => onSearchChange({ account: e.target.value || undefined })}
          >
            <option value="">{t("common.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t("finance.transactions.category")}
            className={selectClass}
            value={search.category ?? ""}
            onChange={(e) => onSearchChange({ category: e.target.value || undefined })}
          >
            <option value="">{t("common.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {categoryName(c)}
              </option>
            ))}
          </select>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onSearchChange({ account: undefined, category: undefined, q: undefined })
              }
            >
              {t("common.clearFilters")}
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-destructive">{error.message}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {review ? (
            <>
              <Inbox className="mx-auto mb-2 size-6" />
              <p className="font-medium text-foreground">
                {t("finance.transactions.nothingToReview")}
              </p>
              <p className="mt-1">{t("finance.transactions.nothingToReviewBody")}</p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {filtered
                  ? t("finance.transactions.noMatches")
                  : t("finance.transactions.nothingIn", { month: formatMonth(month) })}
              </p>
              <p className="mt-1">
                <Trans
                  i18nKey="finance.transactions.logHint"
                  components={{ kbd: <kbd className="rounded border px-1 font-mono text-xs" /> }}
                />
              </p>
            </>
          )}
        </div>
      )}

      {days.map((day) => {
        // In the main currency, so a day with £ and ₫ spending adds up.
        const spent = day.items.reduce((sum, tx) => {
          if (tx.amountMinor >= 0 || tx.isTransfer) return sum;
          return sum + (toMain(-tx.amountMinor, tx.account.currency) ?? 0);
        }, 0);
        return (
          <section key={day.date} aria-label={formatDayHeading(day.date)}>
            <div className="flex items-baseline justify-between px-1 pb-2">
              <h2 className="text-sm font-medium">{formatDayHeading(day.date)}</h2>
              {spent > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("finance.transactions.spent", {
                    amount: formatMoney(spent, main),
                  })}
                </span>
              )}
            </div>
            <Card>
              <ul className="divide-y">
                {day.items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    categories={categories}
                    review={review}
                    onOpen={() => {
                      setLastEdited(tx);
                      setEditing(tx);
                    }}
                    onCategorise={(categoryId) => categorise(tx, categoryId)}
                  />
                ))}
              </ul>
            </Card>
          </section>
        );
      })}

      {nextCursor && (
        <Button
          variant="outline"
          className="self-center"
          disabled={loading}
          onClick={() => fetchMore({ variables: { after: nextCursor } })}
        >
          {loading ? t("common.loading") : t("common.loadMore")}
        </Button>
      )}

      <TransactionForm open={adding} onOpenChange={setAdding} />
      <CsvImportDialog open={importing} onOpenChange={setImporting} />
      <TransferDialog
        open={transferring}
        onOpenChange={setTransferring}
        preset={{ kind: "transfer" }}
      />
      {lastEdited && (
        <TransactionForm
          key={lastEdited.id}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          transaction={lastEdited}
          onDelete={() => remove(lastEdited)}
        />
      )}
    </div>
  );
}

function TransactionRow({
  transaction: tx,
  categories,
  review,
  onOpen,
  onCategorise,
}: {
  transaction: Transaction;
  categories: Category[];
  review: boolean;
  onOpen: () => void;
  onCategorise: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  // An incoming transfer is your own money moving, not income.
  const income = tx.amountMinor > 0 && !tx.isTransfer;
  const title = tx.isTransfer
    ? t(tx.amountMinor < 0 ? "finance.transfer.toArrow" : "finance.transfer.fromArrow", {
        name: tx.transferAccount?.name ?? tx.payee ?? "",
      })
    : (tx.payee ?? tx.note ?? categoryName(tx.category));
  const detail = tx.isTransfer
    ? [tx.note, t("finance.transfer.title"), tx.account.name].filter(Boolean)
    : [
        tx.payee && tx.note,
        !review && (tx.category ? categoryName(tx.category) : t("finance.toReview")),
        tx.account.name,
      ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:underline"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-base"
        >
          {tx.isTransfer ? <ArrowLeftRight className="size-3.5" /> : (tx.category?.icon ?? "•")}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span
            className={cn(
              "block truncate text-xs text-muted-foreground",
              !tx.category && !tx.isTransfer && !review && "text-amber-700 dark:text-amber-400",
            )}
          >
            {detail.join(" · ")}
          </span>
        </span>
      </button>

      {review && (
        <select
          aria-label={t("finance.transactions.categoryFor", { title })}
          data-categorise={tx.id}
          defaultValue=""
          onChange={(e) => e.target.value && onCategorise(e.target.value)}
          className="h-8 max-w-40 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="" disabled>
            {t("finance.transactions.categorise")}
          </option>
          {categories
            .filter((c) => c.kind === (income ? "income" : "expense"))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {categoryName(c)}
              </option>
            ))}
        </select>
      )}

      <Amount
        minor={tx.amountMinor}
        currency={tx.account.currency}
        tone={tx.isTransfer ? "neutral" : "auto"}
        className="shrink-0 text-sm font-medium"
      />
    </li>
  );
}

/** Updates the URL 300 ms after typing stops, not on every key. */
function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  // "Clear filters" (or back/forward) changes the URL: show that.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onChangeRef.current(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value]);

  return (
    <div className="relative min-w-48 flex-1 sm:max-w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={t("finance.transactions.searchPlaceholder")}
        placeholder={t("finance.transactions.searchPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
