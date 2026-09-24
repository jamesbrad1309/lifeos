import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:mm (24h)");

const base = {
  date: isoDate,
  time: time.nullable().optional(),
  triggerId: z.string().uuid().nullable().optional(),
};

/**
 * One schema for both create and update (PUT replaces the whole entry), so
 * the per-kind rules live in one place: actions and events need text, a
 * feeling needs an emotion and its text ("why?") is optional.
 */
export const journalEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("ACTION"),
    text: z.string().trim().min(1).max(2000),
    durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("FEELING"),
    text: z.string().trim().max(2000).default(""),
    emotion: z.string().trim().min(1).max(40),
    intensity: z.number().int().min(1).max(5).default(3),
  }),
  z.object({
    ...base,
    kind: z.literal("EVENT"),
    text: z.string().trim().min(1).max(2000),
    tone: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).nullable().optional(),
  }),
]);

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

/**
 * A list written in one go (the composer's textarea). An item nested under
 * an EVENT in that list points at it by position via `triggerIndex`, since
 * the event has no id until the batch is saved.
 */
export const createJournalEntriesSchema = z
  .array(
    journalEntrySchema.and(
      z.object({ triggerIndex: z.number().int().min(0).nullable().optional() }),
    ),
  )
  .min(1)
  .max(50);

export type CreateJournalEntriesInput = z.infer<typeof createJournalEntriesSchema>;
