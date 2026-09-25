import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM");

export const budgetReportSchema = z.object({
  month: yearMonth,
  /** The client's calendar day, for how far through the month we are. */
  today: isoDate.optional(),
});
export type BudgetReportInput = z.infer<typeof budgetReportSchema>;

/** Sets a limit from `month` on (it carries forward until changed). */
export const setBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  month: yearMonth,
  amountMinor: minor.positive(),
  rollover: z.boolean().default(false),
});
export type SetBudgetInput = z.infer<typeof setBudgetSchema>;

export const removeBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  month: yearMonth,
});
export type RemoveBudgetInput = z.infer<typeof removeBudgetSchema>;
