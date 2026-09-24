import { Module } from "@nestjs/common";
import { HabitEntriesController } from "#habit-entries/habit-entries.controller";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";

@Module({
  controllers: [HabitEntriesController],
  providers: [HabitEntriesService],
  exports: [HabitEntriesService],
})
export class HabitEntriesModule {}
