import { useMutation, useQuery } from "@apollo/client/react";
import { ArchiveRestore, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MONEY_OUT_CLASS } from "#components/finance/Amount";
import { AccountForm } from "#components/finance/setup/AccountForm";
import { AccountRow } from "#components/finance/setup/AccountRow";
import { ReconcileDialog } from "#components/finance/setup/ReconcileDialog";
import {
  TransferDialog,
  type TransferPreset,
} from "#components/finance/transactions/TransferDialog";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import {
  ACCOUNTS_QUERY,
  ACCOUNTS_REFETCH,
  REORDER_ACCOUNTS_MUTATION,
  SET_DEFAULT_ACCOUNT_MUTATION,
  UNARCHIVE_ACCOUNT_MUTATION,
} from "#graphql/finance";
import type { Account, AccountType, AccountsData, NetWorth } from "#graphql/types";
import { ACCOUNT_GROUPS, ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER } from "#lib/account-types";
import { daysBetween, formatShortDate, todayIsoDate } from "#lib/dates";
import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

type Dialog =
  | { kind: "add"; type?: AccountType }
  | { kind: "transfer"; preset: TransferPreset }
  | { kind: "edit"; account: Account }
  | { kind: "reconcile"; account: Account }
  | null;

/**
 * Money setup: every account, card, loan and IOU on one screen, grouped by
 * type, with net worth and what's coming up alongside. Set up once and
 * rarely touched; see docs/finance/account-setup.md.
 */
export function MoneySetup() {
  const { t } = useTranslation();
  const { data, error } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const [dialog, setDialog] = useState<Dialog>(null);
  // Keeps the last dialog's account while it animates closed.
  const [lastAccount, setLastAccount] = useState<Account | null>(null);
  const [lastTransfer, setLastTransfer] = useState<TransferPreset>({ kind: "transfer" });

  const mutationOptions = { refetchQueries: ACCOUNTS_REFETCH, awaitRefetchQueries: true };
  const [setDefault] = useMutation(SET_DEFAULT_ACCOUNT_MUTATION, mutationOptions);
  const [reorder] = useMutation(REORDER_ACCOUNTS_MUTATION, mutationOptions);
  const [unarchive] = useMutation(UNARCHIVE_ACCOUNT_MUTATION, mutationOptions);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Row actions have no dialog to show a failure in, so it goes in a banner above the list. */
  function run(action: () => Promise<unknown>) {
    setActionError(null);
    action().catch((err) =>
      setActionError(err instanceof Error ? err.message : t("common.somethingWentWrong")),
    );
  }

  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) return null;

  const { accounts, archivedAccounts, netWorth } = data;

  function open(next: Dialog) {
    if (next && (next.kind === "edit" || next.kind === "reconcile")) setLastAccount(next.account);
    if (next?.kind === "transfer") setLastTransfer(next.preset);
    setDialog(next);
  }

  /** Where a payment comes from by default: the default account, else the first bank or cash one. */
  function paymentSource(exclude: Account): Account | undefined {
    const candidates = accounts.filter(
      (a) => a.id !== exclude.id && ["CURRENT", "SAVINGS", "CASH"].includes(a.type),
    );
    return candidates.find((a) => a.isDefault) ?? candidates[0];
  }

  /**
   * "Pay off" for a card or loan that's owed, "Settle up" for an IOU: a
   * transfer, pre-filled with both accounts and the amount (when both are
   * in the same currency).
   */
  function transferFor(account: Account): { label: string; run: () => void } | undefined {
    const owedToSomeone = account.balanceMinor < 0;
    const source = paymentSource(account);
    const sameCurrency = source?.currency === account.currency;
    const amountMinor = sameCurrency ? Math.abs(account.balanceMinor) : undefined;
    if ((account.type === "CREDIT_CARD" || account.type === "LOAN") && owedToSomeone) {
      return {
        label: t("finance.transfer.payOff"),
        run: () =>
          open({
            kind: "transfer",
            preset: {
              kind: "payOff",
              name: account.name,
              fromAccountId: source?.id,
              toAccountId: account.id,
              amountMinor,
            },
          }),
      };
    }
    if (account.type === "IOU" && account.balanceMinor !== 0) {
      // You owe them: money goes to the IOU. They owe you: it comes from it.
      const [fromAccountId, toAccountId] = owedToSomeone
        ? [source?.id, account.id]
        : [account.id, source?.id];
      return {
        label: t("finance.transfer.settleUp"),
        run: () =>
          open({
            kind: "transfer",
            preset: { kind: "settle", name: account.name, fromAccountId, toAccountId, amountMinor },
          }),
      };
    }
    return undefined;
  }

  /** Swaps an account with its neighbour in the same group, keeping everything else in place. */
  function move(account: Account, groupMates: Account[], by: -1 | 1) {
    const neighbour = groupMates[groupMates.indexOf(account) + by];
    if (!neighbour) return;
    const ids = accounts.map((a) => a.id);
    const i = ids.indexOf(account.id);
    const j = ids.indexOf(neighbour.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorder({ variables: { ids } }));
  }

  const dialogs = (
    <>
      <TransferDialog
        open={dialog?.kind === "transfer"}
        onOpenChange={(o) => !o && setDialog(null)}
        preset={lastTransfer}
      />
      <AccountForm
        open={dialog?.kind === "add"}
        onOpenChange={(o) => !o && setDialog(null)}
        initialType={dialog?.kind === "add" ? dialog.type : undefined}
      />
      {lastAccount && (
        <>
          <AccountForm
            key={`edit-${lastAccount.id}`}
            open={dialog?.kind === "edit"}
            onOpenChange={(o) => !o && setDialog(null)}
            account={lastAccount}
          />
          <ReconcileDialog
            open={dialog?.kind === "reconcile"}
            onOpenChange={(o) => !o && setDialog(null)}
            account={lastAccount}
          />
        </>
      )}
    </>
  );

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {actionError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </p>
        )}
        <EmptyState onAdd={(type) => open({ kind: "add", type })} />
        {archivedAccounts.length > 0 && (
          <ArchivedList
            accounts={archivedAccounts}
            onRestore={(id) => run(() => unarchive({ variables: { id } }))}
          />
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {actionError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t("finance.setup.accountCount", { count: accounts.length })}
          </p>
          <Button size="sm" onClick={() => open({ kind: "add" })}>
            <Plus className="size-4" /> {t("finance.setup.addAccount")}
          </Button>
        </div>

        {ACCOUNT_GROUPS.map((group) => {
          const members = accounts.filter((a) => group.types.includes(a.type));
          if (members.length === 0) return null;
          // In the main currency, so accounts in different currencies add up.
          const total = members.reduce((sum, a) => sum + (a.balanceMainMinor ?? 0), 0);
          return (
            <section key={group.label} aria-labelledby={`group-${group.label}`}>
              <div className="flex items-baseline justify-between px-1 pb-2">
                <h2
                  id={`group-${group.label}`}
                  className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
                >
                  {t(`finance.groups.${group.label}`)}
                </h2>
                <span
                  className={cn(
                    "text-xs text-muted-foreground tabular-nums",
                    total < 0 && MONEY_OUT_CLASS,
                  )}
                >
                  {formatMoney(total, netWorth.currency)}
                </span>
              </div>
              <Card>
                <ul className="divide-y">
                  {members.map((account, i) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      mainCurrency={netWorth.currency}
                      onEdit={() => open({ kind: "edit", account })}
                      onReconcile={() => open({ kind: "reconcile", account })}
                      onTransfer={transferFor(account)}
                      onMakeDefault={
                        !account.isDefault && ACCOUNT_TYPES[account.type].spendable
                          ? () => run(() => setDefault({ variables: { id: account.id } }))
                          : undefined
                      }
                      onMoveUp={i > 0 ? () => move(account, members, -1) : undefined}
                      onMoveDown={
                        i < members.length - 1 ? () => move(account, members, 1) : undefined
                      }
                    />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
        <NetWorthCard netWorth={netWorth} />
        <ComingUp accounts={accounts} />
        {archivedAccounts.length > 0 && (
          <ArchivedList
            accounts={archivedAccounts}
            onRestore={(id) => run(() => unarchive({ variables: { id } }))}
          />
        )}
      </aside>

      {dialogs}
    </div>
  );
}

function NetWorthCard({ netWorth }: { netWorth: NetWorth }) {
  const { t } = useTranslation();
  const { currency } = netWorth;
  const total = netWorth.assetsMinor + netWorth.liabilitiesMinor;
  const assetShare = total > 0 ? (netWorth.assetsMinor / total) * 100 : 100;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {t("finance.setup.netWorth")}
        </p>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            netWorth.netWorthMinor < 0 && MONEY_OUT_CLASS,
          )}
        >
          {formatMoney(netWorth.netWorthMinor, currency)}
        </p>
        <div
          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={t("finance.setup.assetsShare", {
            assets: Math.round(assetShare),
            owed: Math.round(100 - assetShare),
          })}
        >
          <div className="bg-emerald-500" style={{ width: `${assetShare}%` }} />
          <div className="flex-1 bg-rose-400/70" />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" /> {t("finance.setup.assets")}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(netWorth.assetsMinor, currency)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-rose-400/70" /> {t("finance.setup.owed")}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(netWorth.liabilitiesMinor, currency)}
            </dd>
          </div>
        </dl>
        {netWorth.unconverted.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("finance.currencies.notConverted", { codes: netWorth.unconverted.join(", ") })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Card payments due and IOUs to settle in the next 31 days, soonest first. */
function ComingUp({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const items = accounts
    .flatMap((a) => {
      if (a.type === "CREDIT_CARD" && a.nextDueDate && a.balanceMinor < 0) {
        return [
          {
            account: a,
            date: a.nextDueDate,
            label: t("finance.setup.cardPayment", { name: a.name }),
          },
        ];
      }
      if (a.type === "IOU" && a.dueDate && a.balanceMinor !== 0) {
        const label =
          a.balanceMinor < 0
            ? t("finance.setup.payBack", { name: a.name })
            : t("finance.setup.paysYouBack", { name: a.name });
        return [{ account: a, date: a.dueDate, label }];
      }
      return [];
    })
    .filter((item) => daysBetween(today, item.date) <= 31)
    .sort((x, y) => x.date.localeCompare(y.date));

  if (items.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">{t("finance.setup.comingUp")}</p>
        <ul className="flex flex-col gap-2.5">
          {items.map(({ account, date, label }) => {
            const days = daysBetween(today, date);
            const minimum = account.type === "CREDIT_CARD" ? account.minPaymentMinor : null;
            return (
              <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{label}</p>
                  <p
                    className={cn(
                      "text-xs text-muted-foreground",
                      days <= 7 && "font-medium text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {days < 0
                      ? t("common.daysOverdue", { count: -days })
                      : days === 0
                        ? t("common.today")
                        : t("finance.setup.dueOn", {
                            date: formatShortDate(date),
                            inDays: t("common.inDays", { count: days }),
                          })}
                  </p>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatMoney(Math.abs(account.balanceMinor), account.currency)}
                  {minimum != null && (
                    <span className="block">
                      {t("finance.setup.minimum", {
                        amount: formatMoney(minimum, account.currency),
                      })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ArchivedList({
  accounts,
  onRestore,
}: {
  accounts: Account[];
  onRestore: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <details className="group rounded-xl border bg-card text-sm shadow-sm">
      <summary className="cursor-pointer list-none p-4 text-muted-foreground select-none marker:hidden">
        {t("finance.setup.archived", { count: accounts.length })}
      </summary>
      <ul className="flex flex-col gap-1 px-2 pb-2">
        {accounts.map((account) => {
          const Icon = ACCOUNT_TYPES[account.type].icon;
          return (
            <li key={account.id} className="flex items-center gap-2 rounded-md px-2 py-1">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{account.name}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("finance.setup.restoreAccount", { name: account.name })}
                onClick={() => onRestore(account.id)}
              >
                <ArchiveRestore className="size-3.5" /> {t("common.restore")}
              </Button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function EmptyState({ onAdd }: { onAdd: (type: AccountType) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t("finance.setup.emptyTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("finance.setup.emptyBody")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_TYPE_ORDER.map((type) => {
          const config = ACCOUNT_TYPES[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <config.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(`finance.accountTypes.${type}.label`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`finance.accountTypes.${type}.hint`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
