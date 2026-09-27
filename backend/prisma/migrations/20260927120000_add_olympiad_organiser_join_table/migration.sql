-- CreateTable: OlympiadOrganiser join table for co-organiser access (#243)
CREATE TABLE "OlympiadOrganiser" (
    "id" TEXT NOT NULL,
    "olympiadId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OlympiadOrganiser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique pair per olympiad + organiser
CREATE UNIQUE INDEX "OlympiadOrganiser_olympiadId_organiserId_key" ON "OlympiadOrganiser"("olympiadId", "organiserId");

-- Backfill (#244): every existing Olympiad.organiserId gets a matching row
-- so current creator access isn't lost after the membership check rollout.
INSERT INTO "OlympiadOrganiser" ("id", "olympiadId", "organiserId", "addedAt")
SELECT
    gen_random_uuid(),
    o."id",
    o."organiserId",
    NOW()
FROM "Olympiad" o
WHERE o."organiserId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "OlympiadOrganiser" ADD CONSTRAINT "OlympiadOrganiser_olympiadId_fkey" FOREIGN KEY ("olympiadId") REFERENCES "Olympiad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OlympiadOrganiser" ADD CONSTRAINT "OlympiadOrganiser_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
