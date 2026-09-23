import { Injectable } from "@nestjs/common";
import type { HabitEntry, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { UpsertHabitEntryInput } from "#habit-entries/dto/upsert-habit-entry.dto";

const log = scopedLogger("HabitEntriesService");

@Injectable()
export class HabitEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  findForHabitsOnDate(habitIds: readonly string[], date: string): Promise<HabitEntry[]> {
    if (habitIds.length === 0) return Promise.resolve([]);
    return this.prisma.habitEntry.findMany({
      where: { habitId: { in: [...habitIds] }, date: new Date(date) },
    });
  }

  findForHabit(habitId: string): Promise<HabitEntry[]> {
    return this.prisma.habitEntry.findMany({
      where: { habitId },
      orderBy: { date: "desc" },
    });
  }

  findForHabitsSince(habitIds: readonly string[], since: Date): Promise<HabitEntry[]> {
    if (habitIds.length === 0) return Promise.resolve([]);
    return this.prisma.habitEntry.findMany({
      where: { habitId: { in: [...habitIds] }, date: { gte: since } },
    });
  }

  async upsert(input: UpsertHabitEntryInput): Promise<HabitEntry> {
    const date = new Date(input.date);
    const existing = await this.prisma.habitEntry.findUnique({
      where: { habitId_date: { habitId: input.habitId, date } },
    });

    const metadata = {
      ...(existing?.metadata as Record<string, unknown> | undefined),
      ...input.metadata,
    } as Prisma.InputJsonValue;

    const entry = await this.prisma.habitEntry.upsert({
      where: { habitId_date: { habitId: input.habitId, date } },
      create: {
        habitId: input.habitId,
        date,
        value: input.value,
        completed: input.completed ?? false,
        note: input.note,
        metadata,
      },
      update: {
        value: input.value ?? existing?.value,
        completed: input.completed ?? existing?.completed ?? false,
        note: input.note ?? existing?.note,
        metadata,
      },
    });
    log.info(
      { habitId: entry.habitId, date: input.date, wasExisting: Boolean(existing) },
      "habit entry upserted",
    );
    return entry;
  }
}
