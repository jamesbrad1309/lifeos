-- CreateTable
CREATE TABLE "habits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "unit" TEXT,
    "targetValue" DOUBLE PRECISION,
    "schedule" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_entries" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habit_entries_habitId_idx" ON "habit_entries"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "habit_entries_habitId_date_key" ON "habit_entries"("habitId", "date");

-- AddForeignKey
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
