-- AlterTable
ALTER TABLE "Olympiad" ADD COLUMN "organiserId" TEXT;

-- AddForeignKey
ALTER TABLE "Olympiad" ADD CONSTRAINT "Olympiad_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
