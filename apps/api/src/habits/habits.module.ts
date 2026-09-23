import { Module } from "@nestjs/common";
import { HabitsService } from "#habits/habits.service";

@Module({
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
