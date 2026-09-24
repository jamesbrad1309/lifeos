-- CreateEnum
CREATE TYPE "JournalEntryKind" AS ENUM ('ACTION', 'FEELING', 'EVENT');

-- CreateEnum
CREATE TYPE "JournalTone" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "JournalEntryKind" NOT NULL,
    "time" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationMinutes" INTEGER,
    "emotion" TEXT,
    "intensity" INTEGER,
    "tone" "JournalTone",
    "triggerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_date_idx" ON "journal_entries"("date");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
