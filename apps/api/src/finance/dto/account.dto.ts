import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

/** Postgres `integer` and GraphQL `Int` are signed 32-bit; stay well inside them. */
const MAX_MINOR = 2_000_000_000;
export const minor = z.number().int().min(-MAX_MINOR).max(MAX_MINOR);
const positiveMinor = minor.positive();
const nonNegativeMinor = minor.nonnegative();

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const dayOfMonth = z.number().int().min(1).max(31).nullable().optional();
/** 0–1000% in basis points. */
const aprBps = z.number().int().min(0).max(100_000).nullable().optional();

const common = {
  name: z.string().trim().min(1).max(80),
  /**
   * ISO 4217, one of the user's currencies. Create only: defaults to the main
   * currency; an account's currency can't change after (its balance and
   * history are in it), so updates ignore it.
   */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "currency must be an ISO 4217 code")
    .optional(),
  institution: optionalText(80),
  last4: z
    .string()
    .regex(/^\d{4}$/, "last4 must be 4 digits")
    .nullable()
    .optional(),
  icon: optionalText(40),
  color: optionalText(40),
};

/**
 * One object per account type, holding only that type's fields
 * (docs/finance/account-setup.md). Create and update share these, so the
 * per-type rules live in one place.
 */
const variants = {
  CURRENT: z.object({ ...common, type: z.literal("CURRENT") }),
  SAVINGS: z.object({ ...common, type: z.literal("SAVINGS") }),
  CASH: z.object({ ...common, type: z.literal("CASH") }),
  INVESTMENT: z.object({ ...common, type: z.literal("INVESTMENT") }),
  CREDIT_CARD: z.object({
    ...common,
    type: z.literal("CREDIT_CARD"),
    creditLimitMinor: positiveMinor,
    statementDay: dayOfMonth,
    paymentDueDay: dayOfMonth,
    minPaymentMinor: nonNegativeMinor.nullable().optional(),
    aprBps,
  }),
  LOAN: z.object({
    ...common,
    type: z.literal("LOAN"),
    aprBps,
    monthlyPaymentMinor: positiveMinor.nullable().optional(),
    loanStartDate: isoDate.nullable().optional(),
    termMonths: z.number().int().min(1).max(600).nullable().optional(),
  }),
  /** `name` is the person. */
  IOU: z.object({
    ...common,
    type: z.literal("IOU"),
    dueDate: isoDate.nullable().optional(),
  }),
};

/** Where tracking starts: today's balance, not history. */
const opening = {
  /**
   * The balance as the user sees it. For cards and loans that's the amount
   * owed, as a positive number; the service stores it negative.
   */
  currentBalanceMinor: minor,
  /** The client's local "today"; defaults to the server's. */
  openingBalanceDate: isoDate.optional(),
};

export const createAccountSchema = z.discriminatedUnion("type", [
  variants.CURRENT.extend(opening),
  variants.SAVINGS.extend(opening),
  variants.CASH.extend(opening),
  variants.INVESTMENT.extend(opening),
  variants.CREDIT_CARD.extend(opening),
  variants.LOAN.extend(opening),
  /** `owedByMe`: true = you owe them (stored negative), false = they owe you. */
  variants.IOU.extend({ ...opening, owedByMe: z.boolean() }),
]);
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * Editing changes details only. The balance changes through reconciling
 * (`POST /accounts/:id/reconcile`), which records the difference, and the
 * type can't change because it decides what the balance's sign means.
 */
export const updateAccountSchema = z.discriminatedUnion("type", [
  variants.CURRENT,
  variants.SAVINGS,
  variants.CASH,
  variants.INVESTMENT,
  variants.CREDIT_CARD,
  variants.LOAN,
  variants.IOU,
]);
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const reorderAccountsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});
export type ReorderAccountsInput = z.infer<typeof reorderAccountsSchema>;

export const reconcileAccountSchema = z.object({
  /** The real balance from the bank, signed like stored balances: negative = owed. */
  actualBalanceMinor: minor,
  date: isoDate,
});
export type ReconcileAccountInput = z.infer<typeof reconcileAccountSchema>;
