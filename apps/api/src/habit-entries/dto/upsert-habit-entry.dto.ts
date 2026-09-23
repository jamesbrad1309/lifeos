import { z } from "zod";

export const upsertHabitEntrySchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().optional(),
  completed: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpsertHabitEntryInput = z.infer<typeof upsertHabitEntrySchema>;
