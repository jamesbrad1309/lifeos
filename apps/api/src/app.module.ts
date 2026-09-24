import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "#common/config/env";
import { DatabaseModule } from "#common/database/database.module";
import { HealthController } from "#common/health/health.controller";
import { HabitEntriesModule } from "#habit-entries/habit-entries.module";
import { HabitsModule } from "#habits/habits.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // In Docker, env vars are injected directly (see docker-compose.yml)
      // and this file simply won't exist — dotenv silently no-ops then.
      envFilePath: ["../../.env", ".env"],
    }),
    DatabaseModule,
    HabitsModule,
    HabitEntriesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
