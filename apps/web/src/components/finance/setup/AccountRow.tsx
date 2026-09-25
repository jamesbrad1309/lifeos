import type { TFunction } from "i18next";
import { ArrowLeftRight, ChevronDown, ChevronUp, Pencil, RefreshCw, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MONEY_OUT_CLASS, moneyToneClass } from "#components/finance/Amount";
import { Button } from "#components/ui/button";
import { Progress } from "#components/ui/progress";
import type { Account } from "#graphql/types";
import { ACCOUNT_TYPES } from "#lib/account-types";
import {
  daysBetween,
  formatDaysAgo,
  formatMonth,
  formatShortDate,
  ordinal,
  todayIsoDate,
} from "#lib/dates";
import { formatBps, formatMoney, formatMoneyShort } from "#lib/money";
import { cn } from "#lib/utils";

interface Props {
  account: Account;
  /** Balances in another currency also show their value in this one. */
  mainCurrency: string;
  onEdit: () => void;
  onReconcile: () => void;
  /** "Pay off" (cards, loans) or "Settle up" (IOUs); absent when there's nothing to pay. */
  onTransfer?: { label: string; run: () => void };
  onMakeDefault?: () => void;
  /** Absent at the top/bottom of its group. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/** Credit-score guidance: under 30% is healthy, above 75% hurts. */
function utilizationClass(utilization: number): string {
  if (utilization > 0.75) return "bg-red-500";
  if (utilization > 0.3) return "bg-amber-500";
  return "bg-emerald-500";
}

export function AccountRow({
  account,
  mainCurrency,
  onEdit,
  onReconcile,
  onTransfer,
  onMakeDefault,
  onMoveUp,
  onMoveDown,
}: Props) {
  const { t } = useTranslation();
  const config = ACCOUNT_TYPES[account.type];
  const owed = -account.balanceMinor;
  const money = (minor: number) => formatMoney(minor, account.currency);

  return (
    <li className="group flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <config.icon className="size-4 text-muted-foreground" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{account.name}</span>
            {account.last4 && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                ··{account.last4}
              </span>
            )}
            {account.isDefault && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400"
                title={t("finance.row.defaultHint")}
              >
                <Star className="size-2.5 fill-current" /> {t("finance.row.default")}
              </span>
            )}
          </p>
          <Details account={account} />
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              // Owed money is red and money owed to you green; an ordinary
              // balance stays plain unless it's overdrawn.
              config.owed || account.type === "IOU"
                ? moneyToneClass(account.balanceMinor)
                : account.balanceMinor < 0 && MONEY_OUT_CLASS,
            )}
          >
            {config.owed || (account.type === "IOU" && account.balanceMinor < 0)
              ? money(Math.abs(account.balanceMinor))
              : money(account.balanceMinor)}
          </p>
          {account.balanceMainMinor !== null && account.currency !== mainCurrency && (
            <p className="text-xs text-muted-foreground tabular-nums">
              ≈ {formatMoney(Math.abs(account.balanceMainMinor), mainCurrency)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {account.type === "IOU"
              ? account.balanceMinor < 0
                ? t("finance.row.youOwe")
                : account.balanceMinor > 0
                  ? t("finance.row.owesYou")
                  : t("finance.row.settled")
              : config.owed
                ? owed > 0
                  ? t("finance.row.owed")
                  : t("finance.row.paidOff")
                : null}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 pl-12 transition-opacity sm:pl-0 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onReconcile}>
          <RefreshCw className="size-3.5" /> {t("finance.row.updateBalance")}
        </Button>
        {onTransfer && (
          <Button variant="ghost" size="sm" onClick={onTransfer.run}>
            <ArrowLeftRight className="size-3.5" /> {onTransfer.label}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("finance.row.editAccount", { name: account.name })}
          title={t("common.edit")}
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        {/* Always takes its space, so balances line up down the list. */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", !onMakeDefault && "invisible")}
          aria-label={t("finance.row.makeDefault", { name: account.name })}
          aria-hidden={!onMakeDefault}
          tabIndex={onMakeDefault ? undefined : -1}
          title={t("finance.row.makeDefaultHint")}
          onClick={onMakeDefault}
        >
          <Star className="size-3.5" />
        </Button>
        <div className="ml-auto flex sm:ml-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("finance.row.moveUp", { name: account.name })}
            disabled={!onMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("finance.row.moveDown", { name: account.name })}
            disabled={!onMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** "today", "tomorrow", "in 5 days", in the app's language. */
function whenLabel(t: TFunction, days: number): string {
  if (days === 0) return t("common.today").toLocaleLowerCase();
  if (days === 1) return t("common.tomorrow").toLocaleLowerCase();
  return t("common.inDays", { count: days });
}

/** The type-specific second line(s): limits and due dates, payoff, who owes whom. */
function Details({ account }: { account: Account }) {
  const { t } = useTranslation();
  const money = (minor: number) => formatMoneyShort(minor, account.currency);
  const today = todayIsoDate();
  const checked = account.lastReconciledAt
    ? t("finance.row.checked", { when: formatDaysAgo(account.lastReconciledAt) })
    : t("finance.row.since", { date: formatShortDate(account.openingBalanceDate) });
  const apr = account.aprBps != null && t("finance.row.apr", { rate: formatBps(account.aprBps) });
  const meta = (parts: (string | null | false)[]) => (
    <p className="truncate text-xs text-muted-foreground">{parts.filter(Boolean).join(" · ")}</p>
  );

  if (account.type === "CREDIT_CARD") {
    const owed = Math.max(0, -account.balanceMinor);
    const utilization = account.utilization ?? 0;
    const dueIn = account.nextDueDate ? daysBetween(today, account.nextDueDate) : null;
    return (
      <div className="mt-1 flex flex-col gap-1.5">
        {account.creditLimitMinor != null && (
          <div className="flex items-center gap-2">
            <Progress
              value={Math.min(100, utilization * 100)}
              className="h-1.5 max-w-40"
              indicatorClassName={utilizationClass(utilization)}
              aria-label={t("finance.row.creditUsed")}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("finance.row.ofLimit", {
                owed: money(owed),
                limit: money(account.creditLimitMinor),
                percent: Math.round(utilization * 100),
              })}
            </span>
          </div>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {[
            account.statementDay &&
              t("finance.row.statement", { day: ordinal(account.statementDay) }),
            apr,
            account.nextDueDate && dueIn !== null && (
              <span
                key="due"
                className={cn(
                  owed > 0 && dueIn <= 7 && "font-medium text-amber-700 dark:text-amber-400",
                )}
              >
                {t("finance.row.due", {
                  date: formatShortDate(account.nextDueDate),
                  when: whenLabel(t, dueIn),
                })}
              </span>
            ),
            checked,
          ]
            .filter(Boolean)
            .flatMap((part, i) => (i === 0 ? [part] : [" · ", part]))}
        </p>
      </div>
    );
  }

  if (account.type === "LOAN") {
    if (account.balanceMinor >= 0) {
      return meta([account.institution, t("finance.row.loanPaidOff"), checked]);
    }
    return (
      <p className="truncate text-xs text-muted-foreground">
        {[
          account.institution,
          account.monthlyPaymentMinor != null &&
            t("finance.row.perMonth", { amount: money(account.monthlyPaymentMinor) }),
          apr,
        ]
          .filter(Boolean)
          .join(" · ")}
        {account.paymentCoversInterest === false ? (
          <span className="font-medium text-red-600 dark:text-red-400">
            {" · "}
            {t("finance.row.paymentTooLow")}
          </span>
        ) : account.estimatedPayoffMonth ? (
          ` · ${t("finance.row.payoffBy", { month: formatMonth(account.estimatedPayoffMonth) })}`
        ) : (
          account.monthlyPaymentMinor == null && ` · ${t("finance.row.addPaymentForPayoff")}`
        )}
      </p>
    );
  }

  if (account.type === "IOU") {
    const overdue = account.dueDate && account.balanceMinor !== 0 && account.dueDate < today;
    return (
      <p className="truncate text-xs text-muted-foreground">
        {account.balanceMinor === 0
          ? t("finance.row.allSettled")
          : account.balanceMinor < 0
            ? t("finance.row.youOweName", { name: account.name })
            : t("finance.row.nameOwesYou", { name: account.name })}
        {account.dueDate && account.balanceMinor !== 0 && (
          <span className={cn(overdue && "font-medium text-amber-700 dark:text-amber-400")}>
            {" · "}
            {overdue
              ? t("finance.row.wasDue", { date: formatShortDate(account.dueDate) })
              : t("finance.row.dueDate", { date: formatShortDate(account.dueDate) })}
          </span>
        )}
      </p>
    );
  }

  return meta([account.institution, checked]);
}
