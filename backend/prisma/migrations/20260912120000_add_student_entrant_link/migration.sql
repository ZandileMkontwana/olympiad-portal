-- AlterTable
ALTER TABLE "Entrant" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Entrant_userId_key" ON "Entrant"("userId");

-- AddForeignKey
ALTER TABLE "Entrant" ADD CONSTRAINT "Entrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
