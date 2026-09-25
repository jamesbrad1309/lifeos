import {
  CreditCard,
  HandCoins,
  Landmark,
  type LucideIcon,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { Account, AccountType } from "#graphql/types";
import type { finance } from "#i18n/en/finance";

/**
 * How each account type behaves. Its words (label, hint, field labels) are in
 * the `finance.accountTypes.<TYPE>` translations.
 */
export interface AccountTypeConfig {
  icon: LucideIcon;
  /** Owed types: the user types what they owe as a positive number. */
  owed: boolean;
  /** Has a bank / issuer / lender / provider field. */
  hasInstitution: boolean;
  hasLast4: boolean;
  /** Types money is spent from: the only ones that can be quick log's default. */
  spendable: boolean;
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeConfig> = {
  CURRENT: {
    icon: Landmark,
    owed: false,
    hasInstitution: true,
    hasLast4: true,
    spendable: true,
  },
  SAVINGS: {
    icon: PiggyBank,
    owed: false,
    hasInstitution: true,
    hasLast4: true,
    spendable: true,
  },
  CREDIT_CARD: {
    icon: CreditCard,
    owed: true,
    hasInstitution: true,
    hasLast4: true,
    spendable: true,
  },
  LOAN: {
    icon: HandCoins,
    owed: true,
    hasInstitution: true,
    hasLast4: false,
    spendable: false,
  },
  IOU: {
    icon: Users,
    owed: false,
    hasInstitution: false,
    hasLast4: false,
    spendable: false,
  },
  CASH: {
    icon: Wallet,
    owed: false,
    hasInstitution: false,
    hasLast4: false,
    spendable: true,
  },
  INVESTMENT: {
    icon: TrendingUp,
    owed: false,
    hasInstitution: true,
    hasLast4: false,
    spendable: false,
  },
};

/** The picker's order: the ones people add first come first. */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "CURRENT",
  "CREDIT_CARD",
  "SAVINGS",
  "CASH",
  "LOAN",
  "IOU",
  "INVESTMENT",
];

/** How the money-setup screen groups accounts; `label` is a `finance.groups` key. */
export const ACCOUNT_GROUPS: { label: keyof typeof finance.groups; types: AccountType[] }[] = [
  { label: "bank", types: ["CURRENT", "SAVINGS"] },
  { label: "cards", types: ["CREDIT_CARD"] },
  { label: "debts", types: ["LOAN", "IOU"] },
  { label: "cash", types: ["CASH"] },
  { label: "investments", types: ["INVESTMENT"] },
];

/**
 * A balance as typed (never negative) → as stored: negative when owed.
 * Mirrors `storedBalance` in apps/api/src/finance/account-metrics.util.ts.
 */
export function signedBalance(type: AccountType, enteredMinor: number, owedByMe = false): number {
  if (ACCOUNT_TYPES[type].owed) return -enteredMinor;
  if (type === "IOU") return owedByMe ? -enteredMinor : enteredMinor;
  return enteredMinor;
}

/** The reverse, for prefilling "Update balance". */
export function enteredBalance(account: Pick<Account, "type" | "balanceMinor">): {
  amountMinor: number;
  owedByMe: boolean;
} {
  if (ACCOUNT_TYPES[account.type].owed) {
    return { amountMinor: -account.balanceMinor, owedByMe: true };
  }
  if (account.type === "IOU") {
    return { amountMinor: Math.abs(account.balanceMinor), owedByMe: account.balanceMinor < 0 };
  }
  return { amountMinor: account.balanceMinor, owedByMe: false };
}
