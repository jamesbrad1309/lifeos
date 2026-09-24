import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { Habit } from "@prisma/client";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { type CreateHabitInput, createHabitSchema } from "#habits/dto/create-habit.dto";
import { type UpdateHabitInput, updateHabitSchema } from "#habits/dto/update-habit.dto";
import { type HabitStats, HabitStatsService } from "#habits/habit-stats.service";
import { HabitsService } from "#habits/habits.service";

/** Comma-separated `?ids=a,b,c` → ["a", "b", "c"]. */
function parseIds(ids: string | undefined): string[] {
  return (ids ?? "").split(",").filter(Boolean);
}

/**
 * Internal REST API consumed by apps/bff. Resource-shaped on purpose — the
 * BFF owns the client-facing (GraphQL) shape. Static routes (`today`,
 * `stats`) are declared before `:id` so Nest doesn't match them as ids.
 */
@Controller("habits")
export class HabitsController {
  constructor(
    private readonly habitsService: HabitsService,
    private readonly habitStatsService: HabitStatsService,
  ) {}

  @Get()
  findAll(@Query("archived") archived?: string): Promise<Habit[]> {
    return archived === "true" ? this.habitsService.findArchived() : this.habitsService.findAll();
  }

  @Get("today")
  findDueToday(): Promise<Habit[]> {
    return this.habitsService.findDueToday();
  }

  /** Batch endpoint — `GET /habits/stats?ids=a,b` — one call per BFF DataLoader batch. */
  @Get("stats")
  stats(@Query("ids") ids?: string): Promise<HabitStats[]> {
    return this.habitStatsService.statsFor(parseIds(ids));
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Habit> {
    return this.habitsService.findOneOrFail(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createHabitSchema)) input: CreateHabitInput): Promise<Habit> {
    return this.habitsService.create(input);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateHabitSchema)) input: UpdateHabitInput,
  ): Promise<Habit> {
    return this.habitsService.update(id, input);
  }

  @Post(":id/archive")
  archive(@Param("id") id: string): Promise<Habit> {
    return this.habitsService.archive(id);
  }

  @Post(":id/unarchive")
  unarchive(@Param("id") id: string): Promise<Habit> {
    return this.habitsService.unarchive(id);
  }

  @Post(":id/pause")
  pause(@Param("id") id: string): Promise<Habit> {
    return this.habitsService.pause(id);
  }

  @Post(":id/resume")
  resume(@Param("id") id: string): Promise<Habit> {
    return this.habitsService.resume(id);
  }
}
