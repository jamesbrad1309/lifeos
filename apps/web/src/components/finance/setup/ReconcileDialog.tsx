import { useMutation } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Amount } from "#components/finance/Amount";
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
import { Label } from "#components/ui/label";
import { ACCOUNTS_REFETCH, RECONCILE_ACCOUNT_MUTATION } from "#graphql/finance";
import type { Account } from "#graphql/types";
import { ACCOUNT_TYPES, enteredBalance, signedBalance } from "#lib/account-types";
import { todayIsoDate } from "#lib/dates";
import { formatMoney, moneyPlaceholder, parseMoneyInput } from "#lib/money";

interface Props {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Update balance": type what the bank says, and the difference is recorded
 * as one Adjustment transaction. This is what keeps numbers right without
 * logging every coffee (docs/finance/account-setup.md).
 */
export function ReconcileDialog({ account, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const config = ACCOUNT_TYPES[account.type];
  const [amount, setAmount] = useState("");
  const [owedByMe, setOwedByMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reconcile, { loading }] = useMutation(RECONCILE_ACCOUNT_MUTATION, {
    refetchQueries: ACCOUNTS_REFETCH,
    awaitRefetchQueries: true,
  });

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAmount("");
      setOwedByMe(enteredBalance(account).owedByMe);
      setError(null);
    }
  }

  const entered = parseMoneyInput(amount, account.currency);
  const actual = entered === null ? null : signedBalance(account.type, entered, owedByMe);
  const difference = actual === null ? null : actual - account.balanceMinor;
  const current = enteredBalance(account);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (actual === null) {
      setError(t("finance.reconcile.enterAmount"));
      return;
    }
    try {
      await reconcile({
        variables: { id: account.id, actualBalanceMinor: actual, date: todayIsoDate() },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("finance.reconcile.couldntUpdate"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("finance.reconcile.title")}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="finance.reconcile.isAt"
                values={{
                  name: account.name,
                  amount: formatMoney(current.amountMinor, account.currency),
                  suffix: config.owed
                    ? t("finance.reconcile.suffixOwed")
                    : account.type === "IOU"
                      ? current.owedByMe
                        ? t("finance.reconcile.suffixYouOwe")
                        : t("finance.reconcile.suffixOwedToYou")
                      : "",
                }}
                components={{ b: <b className="text-foreground tabular-nums" /> }}
              />
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reconcile-amount">
              {t(`finance.accountTypes.${account.type}.balance`)}
            </Label>
            <MoneyInput
              id="reconcile-amount"
              autoFocus
              currency={account.currency}
              placeholder={moneyPlaceholder(account.currency)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {account.type === "IOU" && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: t("finance.form.iOweName", { name: account.name }) },
                { value: false, label: t("finance.form.nameOwesMe", { name: account.name }) },
              ].map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={owedByMe === option.value ? "default" : "outline"}
                  aria-pressed={owedByMe === option.value}
                  onClick={() => setOwedByMe(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}

          <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
            {difference === null ? null : difference === 0 ? (
              t("finance.reconcile.alreadyRight")
            ) : (
              <Trans
                i18nKey="finance.reconcile.willAdjust"
                components={{
                  amount: (
                    <Amount
                      minor={difference}
                      currency={account.currency}
                      className="font-medium"
                    />
                  ),
                }}
              />
            )}
          </p>

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
              {t("finance.reconcile.update")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
