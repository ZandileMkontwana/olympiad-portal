-- AlterTable
ALTER TABLE "Round" ADD COLUMN "qualifyingThreshold" DOUBLE PRECISION;
ALTER TABLE "Round" ADD COLUMN "prerequisiteRoundId" TEXT;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_prerequisiteRoundId_fkey" FOREIGN KEY ("prerequisiteRoundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
