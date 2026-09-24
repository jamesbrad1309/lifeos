import { Controller, Get } from "@nestjs/common";
import { HabitStatsService } from "#habits/habit-stats.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly habitStatsService: HabitStatsService) {}

  @Get("stats")
  stats() {
    return this.habitStatsService.dashboardStats();
  }
}
