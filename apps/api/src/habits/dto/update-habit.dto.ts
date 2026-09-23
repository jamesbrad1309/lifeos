import { z } from "zod";
import { scheduleSchema, startTimeSchema } from "#habits/dto/create-habit.dto";

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  targetValue: z.number().positive().nullable().optional(),
  startTime: startTimeSchema.nullable().optional(),
  schedule: scheduleSchema.optional(),
});

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
