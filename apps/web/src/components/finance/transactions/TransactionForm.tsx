import { useMutation, useQuery } from "@apollo/client/react";
import { Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  CATEGORIES_QUERY,
  CREATE_TRANSACTION_MUTATION,
  TRANSACTIONS_REFETCH,
  UPDATE_TRANSACTION_MUTATION,
} from "#graphql/finance";
import type { AccountsData, Category, Transaction } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { todayIsoDate } from "#lib/dates";
import { parseMoneyInput, toMoneyInput } from "#lib/money";
import { cn } from "#lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this one; without it the form adds a new transaction. */
  transaction?: Transaction;
  /** Deletion is the list's job (it's undoable there). */
  onDelete?: () => void;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

/**
 * The full form: any date, any account, payee and note. Quick log covers the
 * everyday case; this is for corrections and the odd back-dated entry.
 */
export function TransactionForm({ open, onOpenChange, transaction, onDelete }: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const accounts = accountsData?.accounts ?? [];
  const categories = categoriesData?.categories ?? [];

  const initial = () => ({
    income: (transaction?.amountMinor ?? -1) > 0,
    amount: toMoneyInput(
      transaction ? Math.abs(transaction.amountMinor) : null,
      transaction?.account.currency ?? "GBP",
    ),
    date: transaction?.date ?? todayIsoDate(),
    accountId: transaction?.account.id ?? accounts.find((a) => a.isDefault)?.id ?? "",
    categoryId: transaction?.category?.id ?? "",
    payee: transaction?.payee ?? "",
    note: transaction?.note ?? "",
  });
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(initial());
      setError(null);
    }
  }

  const options = { refetchQueries: TRANSACTIONS_REFETCH, awaitRefetchQueries: true };
  const [create, created] = useMutation(CREATE_TRANSACTION_MUTATION, options);
  const [update, updated] = useMutation(UPDATE_TRANSACTION_MUTATION, options);
  const saving = created.loading || updated.loading;

  // Amounts are in the chosen account's currency.
  const currency = accounts.find((a) => a.id === draft.accountId)?.currency ?? "GBP";
  // Transfers and adjustments are generated: only their words are editable.
  const locked = transaction?.isTransfer || transaction?.source === "adjustment";
  const kind = draft.income ? "income" : "expense";
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseMoneyInput(draft.amount, currency);
    if (!locked && !amount) return setError(t("finance.transactions.form.enterAmount"));
    if (!draft.accountId) return setError(t("finance.transactions.form.chooseAccount"));

    const words = { payee: draft.payee.trim() || null, note: draft.note.trim() || null };
    const input = locked
      ? words
      : {
          ...words,
          amountMinor: draft.income ? amount : -(amount ?? 0),
          date: draft.date,
          accountId: draft.accountId,
          categoryId: draft.categoryId || null,
        };
    try {
      if (transaction) await update({ variables: { id: transaction.id, input } });
      else await create({ variables: { input } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {transaction
                ? t("finance.transactions.form.editTitle")
                : t("finance.transactions.form.addTitle")}
            </DialogTitle>
          </DialogHeader>

          {locked && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {transaction?.isTransfer
                ? t("finance.transactions.form.lockedTransfer")
                : t("finance.transactions.form.lockedAdjustment")}
            </p>
          )}

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t("finance.transactions.form.moneyInOrOut")}</legend>
            {[
              { income: false, label: t("finance.transactions.form.expense") },
              { income: true, label: t("finance.transactions.form.income") },
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                disabled={locked}
                variant={draft.income === option.income ? "default" : "outline"}
                aria-pressed={draft.income === option.income}
                onClick={() => {
                  set("income", option.income);
                  set("categoryId", "");
                }}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.transactions.form.amount")} id="tx-amount">
              <MoneyInput
                currency={currency}
                id="tx-amount"
                autoFocus={!transaction}
                disabled={locked}
                value={draft.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.date")} id="tx-date">
              <Input
                id="tx-date"
                type="date"
                disabled={locked}
                max={todayIsoDate()}
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.account")} id="tx-account">
              <select
                id="tx-account"
                className={selectClass}
                disabled={locked}
                value={draft.accountId}
                onChange={(e) => set("accountId", e.target.value)}
              >
                <option value="" disabled>
                  {t("common.choose")}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("finance.transactions.form.category")} id="tx-category">
              <select
                id="tx-category"
                className={selectClass}
                disabled={locked}
                value={draft.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">
                  {locked ? categoryName(transaction?.category) : t("finance.toReview")}
                </option>
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {categoryName(c)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("finance.transactions.form.payee")} id="tx-payee" optional>
              <Input
                id="tx-payee"
                autoComplete="off"
                value={draft.payee}
                onChange={(e) => set("payee", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.note")} id="tx-note" optional>
              <Input
                id="tx-note"
                autoComplete="off"
                value={draft.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className={cn(onDelete && "sm:justify-between")}>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  onOpenChange(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" /> {t("common.delete")}
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {transaction ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  optional,
  children,
}: {
  label: string;
  id: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("common.optional")}</span>
        )}
      </Label>
      {children}
    </div>
  );
}
