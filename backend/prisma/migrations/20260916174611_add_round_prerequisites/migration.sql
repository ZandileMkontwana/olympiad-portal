-- AlterTable
-- qualifyingThreshold is also added by 20260913154405_add_qualifying_threshold
-- (merged from main); IF NOT EXISTS keeps fresh deploys working.
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "qualifyingThreshold" DOUBLE PRECISION;
ALTER TABLE "Round" ADD COLUMN "prerequisiteRoundId" TEXT;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_prerequisiteRoundId_fkey" FOREIGN KEY ("prerequisiteRoundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
