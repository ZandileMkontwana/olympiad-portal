-- CreateTable
CREATE TABLE "MarkingTask" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "assignedToId" TEXT,
    "score" DOUBLE PRECISION,
    "breakdown" JSONB,
    "markedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "moderatedScore" DOUBLE PRECISION,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarkingTask_submissionId_key" ON "MarkingTask"("submissionId");

-- AddForeignKey
ALTER TABLE "MarkingTask" ADD CONSTRAINT "MarkingTask_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkingTask" ADD CONSTRAINT "MarkingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkingTask" ADD CONSTRAINT "MarkingTask_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
