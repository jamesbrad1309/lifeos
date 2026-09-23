import { z } from "zod";

export const scheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly"), daysOfWeek: z.array(z.number().int().min(0).max(6)) }),
  z.object({ type: z.literal("timesPerWeek"), count: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal("interval"), everyNDays: z.number().int().min(1) }),
]);

export const startTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be HH:mm (24h)");

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  unit: z.string().max(50).optional(),
  targetValue: z.number().positive().optional(),
  startTime: startTimeSchema.optional(),
  schedule: scheduleSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
