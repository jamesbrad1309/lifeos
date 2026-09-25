import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** `GET /quick-log/context`: the client's local time, so ranking uses it. */
export const quickLogContextSchema = z.object({
  hour: z.coerce.number().int().min(0).max(23),
  /** 0 = Sunday, like Date.getDay(). */
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  /** Date.getTimezoneOffset(): minutes to add to local time to get UTC. */
  utcOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
  today: isoDate.optional(),
});
export type QuickLogContextInput = z.infer<typeof quickLogContextSchema>;

export const quickLogSchema = z.object({
  /** Client-generated; the same id twice logs once (double taps, retries). */
  clientId: z.string().uuid(),
  /** Positive: `isIncome` decides the sign. */
  amountMinor: minor.positive(),
  isIncome: z.boolean().default(false),
  /** Null → the "To review" inbox. */
  categoryId: z.string().uuid().nullable().optional(),
  /** Null → the default account. */
  accountId: z.string().uuid().nullable().optional(),
  /** Client's local date; defaults to the server's today. */
  date: isoDate.optional(),
  payee: optionalText(200),
  note: optionalText(1000),
  presetId: z.string().uuid().nullable().optional(),
  /** Open-to-save time, logged at debug to watch for friction. */
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});
export type QuickLogInput = z.infer<typeof quickLogSchema>;

export const createQuickPresetSchema = z.object({
  label: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(16).nullable().optional(),
  /** Null → tapping it opens the keypad with the category chosen. */
  amountMinor: minor.positive().nullable().optional(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  payee: optionalText(200),
});
export type CreateQuickPresetInput = z.infer<typeof createQuickPresetSchema>;
