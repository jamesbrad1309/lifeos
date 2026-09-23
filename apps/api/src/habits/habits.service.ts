import { Injectable, NotFoundException } from "@nestjs/common";
import type { Habit, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { CreateHabitInput } from "#habits/dto/create-habit.dto";
import type { UpdateHabitInput } from "#habits/dto/update-habit.dto";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";

const log = scopedLogger("HabitsService");

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Habit[]> {
    return this.prisma.habit.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  findArchived(): Promise<Habit[]> {
    return this.prisma.habit.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
    });
  }

  async findDueToday(): Promise<Habit[]> {
    const all = await this.prisma.habit.findMany({
      where: { archivedAt: null, pausedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const today = new Date();
    return all.filter((habit) => isDueOn(habit.schedule as HabitSchedule, today));
  }

  async findOneOrFail(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.findUnique({ where: { id } });
    if (!habit) {
      throw new NotFoundException(`Habit ${id} not found`);
    }
    return habit;
  }

  async create(input: CreateHabitInput): Promise<Habit> {
    const habit = await this.prisma.habit.create({
      data: {
        ...input,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    // `name` is a reserved pino field (it renames the logger itself in
    // output), so the habit's name is logged as `habitName` instead.
    log.info({ habitId: habit.id, habitName: habit.name }, "habit created");
    return habit;
  }

  async update(id: string, input: UpdateHabitInput): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        ...input,
        schedule: input.schedule as Prisma.InputJsonValue | undefined,
      },
    });
    log.info({ habitId: habit.id }, "habit updated");
    return habit;
  }

  async archive(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    log.info({ habitId: habit.id }, "habit archived");
    return habit;
  }

  async unarchive(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { archivedAt: null },
    });
    log.info({ habitId: habit.id }, "habit unarchived");
    return habit;
  }

  async pause(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { pausedAt: new Date() },
    });
    log.info({ habitId: habit.id }, "habit paused");
    return habit;
  }

  async resume(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { pausedAt: null },
    });
    log.info({ habitId: habit.id }, "habit resumed");
    return habit;
  }
}
