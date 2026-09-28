-- AlterTable
ALTER TABLE "RemarkRequest" ADD COLUMN "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "RemarkRequest_assignedToId_status_idx" ON "RemarkRequest"("assignedToId", "status");

-- AddForeignKey
ALTER TABLE "RemarkRequest" ADD CONSTRAINT "RemarkRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
