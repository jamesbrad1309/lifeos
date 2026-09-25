import type { Account, AccountType } from "@prisma/client";
import { monthAfter, nextDayOfMonth, previousDayOfMonth, toIsoDate } from "#finance/calendar.util";

/**
 * Everything the money-setup screen shows that is derived rather than
 * stored (docs/finance/account-setup.md, "Derived values"). Fields that
 * don't apply to an account's type are null.
 */
export interface AccountMetrics {
  accountId: string;
  /** openingBalanceMinor + every transaction since. Negative = owed. In the account's currency. */
  balanceMinor: number;
  /** The balance in the main currency at today's rate; null when there's no rate yet. */
  balanceMainMinor: number | null;
  /** Card: limit + balance (the balance is negative while owing). */
  availableCreditMinor: number | null;
  /** Card: owed / limit, 0–1 (above 1 when over the limit). */
  utilization: number | null;
  /** Card: YYYY-MM-DD of the next payment due day, today included. */
  nextDueDate: string | null;
  /** Card: outflows since the last statement closed, as a positive amount. */
  currentStatementSpendMinor: number | null;
  /** Loan: YYYY-MM it's paid off at the current payment and APR. */
  estimatedPayoffMonth: string | null;
  /** Loan: false when the monthly payment doesn't cover the interest, so it never pays off. */
  paymentCoversInterest: boolean | null;
}

/** Types that money is spent from, and so can be quick log's default account. */
export const SPENDABLE_TYPES: readonly AccountType[] = [
  "CURRENT",
  "SAVINGS",
  "CREDIT_CARD",
  "CASH",
];

/**
 * For owed amounts the user types a positive number ("I owe £640") and the
 * database stores it negative. IOUs go either way, depending on who owes.
 */
export function storedBalance(type: AccountType, enteredMinor: number, owedByMe?: boolean): number {
  if (type === "CREDIT_CARD" || type === "LOAN") return -enteredMinor;
  if (type === "IOU") return owedByMe ? -enteredMinor : enteredMinor;
  return enteredMinor;
}

/** The day the current statement period started from: the last `statementDay` on or before today. */
export function lastStatementDate(statementDay: number, today: Date): Date {
  return previousDayOfMonth(today, statementDay);
}

/**
 * Months to pay off `owedMinor` at `monthlyPaymentMinor` and `aprBps`:
 * n = −ln(1 − r·P/A) / ln(1 + r), r = APR / 12. Null when the payment
 * doesn't cover the interest.
 */
export function payoffMonths(
  owedMinor: number,
  monthlyPaymentMinor: number,
  aprBps: number,
): number | null {
  const r = aprBps / 10_000 / 12;
  if (r === 0) return Math.ceil(owedMinor / monthlyPaymentMinor);
  if (monthlyPaymentMinor <= r * owedMinor) return null;
  return Math.ceil(-Math.log(1 - (r * owedMinor) / monthlyPaymentMinor) / Math.log(1 + r));
}

export function accountMetrics(
  account: Account,
  transactionSumMinor: number,
  statementSpendMinor: number,
  today: Date,
): AccountMetrics {
  const balanceMinor = account.openingBalanceMinor + transactionSumMinor;
  const owedMinor = Math.max(0, -balanceMinor);
  const metrics: AccountMetrics = {
    accountId: account.id,
    balanceMinor,
    // Filled in by AccountsService, which has the exchange rates.
    balanceMainMinor: null,
    availableCreditMinor: null,
    utilization: null,
    nextDueDate: null,
    currentStatementSpendMinor: null,
    estimatedPayoffMonth: null,
    paymentCoversInterest: null,
  };

  if (account.type === "CREDIT_CARD") {
    if (account.creditLimitMinor) {
      metrics.availableCreditMinor = account.creditLimitMinor + balanceMinor;
      metrics.utilization = owedMinor / account.creditLimitMinor;
    }
    if (account.paymentDueDay) {
      metrics.nextDueDate = toIsoDate(nextDayOfMonth(today, account.paymentDueDay));
    }
    if (account.statementDay) metrics.currentStatementSpendMinor = statementSpendMinor;
  }

  if (account.type === "LOAN" && account.monthlyPaymentMinor && owedMinor > 0) {
    const months = payoffMonths(owedMinor, account.monthlyPaymentMinor, account.aprBps ?? 0);
    metrics.paymentCoversInterest = months !== null;
    metrics.estimatedPayoffMonth = months === null ? null : monthAfter(today, months);
  }

  return metrics;
}
