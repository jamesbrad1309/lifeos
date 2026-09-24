import { Module } from "@nestjs/common";
import { JournalController } from "#journal/journal.controller";
import { JournalService } from "#journal/journal.service";

@Module({
  controllers: [JournalController],
  providers: [JournalService],
})
export class JournalModule {}
