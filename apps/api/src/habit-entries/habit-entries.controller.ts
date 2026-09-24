import { BadRequestException, Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import type { HabitEntry } from "@prisma/client";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type UpsertHabitEntryInput,
  upsertHabitEntrySchema,
} from "#habit-entries/dto/upsert-habit-entry.dto";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `date` is a `@db.Date` column that Prisma returns as a UTC-midnight Date;
 * send it as plain "YYYY-MM-DD" so no consumer has to know that.
 */
function toEntryDto(entry: HabitEntry) {
  return { ...entry, date: entry.date.toISOString().slice(0, 10) };
}

@Controller()
export class HabitEntriesController {
  constructor(private readonly habitEntriesService: HabitEntriesService) {}

  @Get("habits/:habitId/entries")
  async findForHabit(@Param("habitId") habitId: string) {
    return (await this.habitEntriesService.findForHabit(habitId)).map(toEntryDto);
  }

  /** Batch endpoint — `GET /habit-entries/by-date/2026-09-24?habitIds=a,b` — for the BFF's todayEntry loader. */
  @Get("habit-entries/by-date/:date")
  async findForHabitsOnDate(@Param("date") date: string, @Query("habitIds") habitIds?: string) {
    if (!ISO_DATE.test(date)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const ids = (habitIds ?? "").split(",").filter(Boolean);
    return (await this.habitEntriesService.findForHabitsOnDate(ids, date)).map(toEntryDto);
  }

  @Put("habit-entries")
  async upsert(@Body(new ZodValidationPipe(upsertHabitEntrySchema)) input: UpsertHabitEntryInput) {
    return toEntryDto(await this.habitEntriesService.upsert(input));
  }
}
