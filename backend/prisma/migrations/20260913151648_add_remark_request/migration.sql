-- CreateTable
CREATE TABLE "RemarkRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "newScore" DOUBLE PRECISION,
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "RemarkRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RemarkRequest" ADD CONSTRAINT "RemarkRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarkRequest" ADD CONSTRAINT "RemarkRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarkRequest" ADD CONSTRAINT "RemarkRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
