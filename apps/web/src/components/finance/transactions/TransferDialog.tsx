import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowDown } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  CREATE_TRANSFER_MUTATION,
  DELETE_TRANSACTION_MUTATION,
  TRANSACTIONS_REFETCH,
} from "#graphql/finance";
import type { AccountsData, Transaction } from "#graphql/types";
import { useCurrencies } from "#hooks/useCurrencies";
import { todayIsoDate } from "#lib/dates";
import { currencyDigits, formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";
import { toast } from "#lib/toast";

/** What the dialog opens with: "Pay off Amex" fills in both accounts and the amount owed. */
export interface TransferPreset {
  kind: "transfer" | "payOff" | "settle";
  fromAccountId?: string;
  toAccountId?: string;
  /** In the source account's currency. */
  amountMinor?: number;
  /** For the title: the card, loan or person. */
  name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: TransferPreset;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Money between two of your own accounts: paying off a card or loan,
 * settling up with a friend, topping up savings. Two linked transactions
 * that never count as spending or income.
 */
export function TransferDialog({ open, onOpenChange, preset }: Props) {
  const { t } = useTranslation();
  const { list: currencies } = useCurrencies();
  const { data } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const accounts = data?.accounts ?? [];

  const initial = () => ({
    fromAccountId: preset.fromAccountId ?? "",
    toAccountId: preset.toAccountId ?? "",
    amount: preset.amountMinor
      ? toMoneyInput(preset.amountMinor, currencyOfId(preset.fromAccountId))
      : "",
    /** Null: follow the sent amount at today's rate. */
    received: null as string | null,
    date: todayIsoDate(),
    note: "",
    clientId: crypto.randomUUID(),
  });
  const currencyOfId = (id: string | undefined) =>
    accounts.find((a) => a.id === id)?.currency ?? "GBP";

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
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const [createTransfer, { loading }] = useMutation<{ createTransfer: Transaction[] }>(
    CREATE_TRANSFER_MUTATION,
    { refetchQueries: TRANSACTIONS_REFETCH, awaitRefetchQueries: true },
  );
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION_MUTATION, {
    refetchQueries: TRANSACTIONS_REFETCH,
  });

  const fromCurrency = currencyOfId(draft.fromAccountId);
  const toCurrency = currencyOfId(draft.toAccountId);
  const crossCurrency =
    Boolean(draft.fromAccountId && draft.toAccountId) && fromCurrency !== toCurrency;
  const amountMinor = parseMoneyInput(draft.amount, fromCurrency);

  // Today's rate between the two, via the main currency.
  const rateOf = (code: string) => currencies.find((c) => c.code === code)?.rateToMain ?? null;
  const fromRate = rateOf(fromCurrency);
  const toRate = rateOf(toCurrency);
  const suggestedReceived =
    crossCurrency && amountMinor && fromRate && toRate
      ? Math.round(
          (amountMinor / 10 ** currencyDigits(fromCurrency)) *
            (fromRate / toRate) *
            10 ** currencyDigits(toCurrency),
        )
      : null;
  const receivedText =
    draft.received ?? (suggestedReceived ? toMoneyInput(suggestedReceived, toCurrency) : "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.fromAccountId || !draft.toAccountId)
      return setError(t("finance.transfer.chooseAccounts"));
    if (draft.fromAccountId === draft.toAccountId)
      return setError(t("finance.transfer.sameAccount"));
    if (!amountMinor) return setError(t("finance.transfer.enterAmount"));
    const toAmountMinor = crossCurrency ? parseMoneyInput(receivedText, toCurrency) : undefined;
    if (crossCurrency && !toAmountMinor) return setError(t("finance.transfer.enterReceived"));

    try {
      const result = await createTransfer({
        variables: {
          input: {
            fromAccountId: draft.fromAccountId,
            toAccountId: draft.toAccountId,
            date: draft.date,
            amountMinor,
            toAmountMinor,
            note: draft.note.trim() || null,
            clientId: draft.clientId,
          },
        },
      });
      onOpenChange(false);
      const out = result.data?.createTransfer[0];
      const toName = accounts.find((a) => a.id === draft.toAccountId)?.name ?? "";
      toast(
        t("finance.transfer.recorded", {
          amount: formatMoney(amountMinor, fromCurrency),
          name: toName,
        }),
        {
          actions: out
            ? [
                {
                  label: t("common.undo"),
                  onClick: () => deleteTransaction({ variables: { id: out.id } }),
                },
              ]
            : [],
        },
      );
    } catch (err) {
      // Same clientId on retry: a transfer that did go through isn't doubled.
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  const title =
    preset.kind === "payOff"
      ? t("finance.transfer.payOffTitle", { name: preset.name })
      : preset.kind === "settle"
        ? t("finance.transfer.settleTitle", { name: preset.name })
        : t("finance.transfer.title");

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name} · {a.currency}
    </option>
  ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t("finance.transfer.hint")}</DialogDescription>
          </DialogHeader>

          <Field label={t("finance.transfer.from")} id="transfer-from">
            <select
              id="transfer-from"
              className={selectClass}
              value={draft.fromAccountId}
              onChange={(e) => {
                set("fromAccountId", e.target.value);
                set("received", null);
              }}
            >
              <option value="" disabled>
                {t("common.choose")}
              </option>
              {accountOptions}
            </select>
          </Field>
          <ArrowDown className="-my-2 size-4 self-center text-muted-foreground" aria-hidden />
          <Field label={t("finance.transfer.to")} id="transfer-to">
            <select
              id="transfer-to"
              className={selectClass}
              value={draft.toAccountId}
              onChange={(e) => {
                set("toAccountId", e.target.value);
                set("received", null);
              }}
            >
              <option value="" disabled>
                {t("common.choose")}
              </option>
              {accountOptions}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.transfer.amount")} id="transfer-amount">
              <MoneyInput
                id="transfer-amount"
                currency={fromCurrency}
                value={draft.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transfer.date")} id="transfer-date">
              <Input
                id="transfer-date"
                type="date"
                max={todayIsoDate()}
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
          </div>

          {crossCurrency && (
            <Field
              label={t("finance.transfer.received", { currency: toCurrency })}
              id="transfer-received"
            >
              <MoneyInput
                id="transfer-received"
                currency={toCurrency}
                value={receivedText}
                onChange={(e) => set("received", e.target.value)}
              />
              {suggestedReceived !== null && (
                <p className="text-xs text-muted-foreground">
                  {t("finance.transfer.receivedHint", {
                    amount: formatMoney(suggestedReceived, toCurrency),
                  })}
                </p>
              )}
            </Field>
          )}

          <Field label={t("finance.transfer.note")} id="transfer-note" optional>
            <Input
              id="transfer-note"
              autoComplete="off"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {t("finance.transfer.save")}
            </Button>
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
