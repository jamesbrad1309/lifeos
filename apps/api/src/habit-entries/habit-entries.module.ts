import { Module } from "@nestjs/common";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";

@Module({
  providers: [HabitEntriesService],
  exports: [HabitEntriesService],
})
export class HabitEntriesModule {}
