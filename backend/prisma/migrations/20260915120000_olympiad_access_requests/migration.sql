-- Olympiad access requests:
-- Schools gain entry to an olympiad via SchoolOlympiad (pending ->
-- approved/declined, organiser-decided). Olympiad gains organiser-set
-- info fields (description, grades, run dates) shown to educators.

-- AlterTable
ALTER TABLE "Olympiad" ADD COLUMN     "description" TEXT,
ADD COLUMN     "grades" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "endDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SchoolOlympiad" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "olympiadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolOlympiad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolOlympiad_schoolId_olympiadId_key" ON "SchoolOlympiad"("schoolId", "olympiadId");

-- AddForeignKey
ALTER TABLE "SchoolOlympiad" ADD CONSTRAINT "SchoolOlympiad_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolOlympiad" ADD CONSTRAINT "SchoolOlympiad_olympiadId_fkey" FOREIGN KEY ("olympiadId") REFERENCES "Olympiad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: grandfather schools that already have entrants registered in an
-- olympiad's rounds, so existing participation keeps working after the gate.
INSERT INTO "SchoolOlympiad" ("id", "schoolId", "olympiadId", "status", "requestedAt", "decidedAt")
SELECT gen_random_uuid(), "Entrant"."schoolId", "Round"."olympiadId", 'approved', MIN("RoundEntrant"."registeredAt"), MIN("RoundEntrant"."registeredAt")
FROM "RoundEntrant"
JOIN "Entrant" ON "Entrant"."id" = "RoundEntrant"."entrantId"
JOIN "Round" ON "Round"."id" = "RoundEntrant"."roundId"
GROUP BY "Entrant"."schoolId", "Round"."olympiadId"
ON CONFLICT ("schoolId", "olympiadId") DO NOTHING;
