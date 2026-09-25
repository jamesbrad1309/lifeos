import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

const nonZeroMinor = minor.refine((n) => n !== 0, "amount can't be zero");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** The full form: any account, any date on or after the account's opening date. */
export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  date: isoDate,
  /** Signed: negative = money out. */
  amountMinor: nonZeroMinor,
  payee: optionalText(200),
  note: optionalText(1000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** Only the fields sent change; `null` clears an optional one (e.g. back to "To review"). */
export const updateTransactionSchema = createTransactionSchema.partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/** `GET /transactions` query string. */
export const listTransactionsSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(100).optional(),
  /** The "To review" inbox: no category, not a transfer. */
  uncategorised: flag,
  /** Default true. */
  includeTransfers: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  first: z.coerce.number().int().min(1).max(200).default(50),
  after: z.string().max(200).optional(),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

/** Moving money between two of your own accounts: a card payment, a savings top-up, settling an IOU. */
export const createTransferSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    date: isoDate,
    /** Positive, in the source account's currency. */
    amountMinor: minor.positive(),
    /**
     * Positive, in the destination account's currency. Required when the two
     * currencies differ (what actually arrived); must be left out otherwise.
     */
    toAmountMinor: minor.positive().optional(),
    note: optionalText(1000),
    /** Client-generated: the same id twice records one transfer (double clicks, retries). */
    clientId: z.string().uuid().optional(),
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, {
    message: "A transfer needs two different accounts",
    path: ["toAccountId"],
  });
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
