-- CreateTable
CREATE TABLE "RoundEntrant" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "entrantId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundEntrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundEntrant_roundId_entrantId_key" ON "RoundEntrant"("roundId", "entrantId");

-- AddForeignKey
ALTER TABLE "RoundEntrant" ADD CONSTRAINT "RoundEntrant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundEntrant" ADD CONSTRAINT "RoundEntrant_entrantId_fkey" FOREIGN KEY ("entrantId") REFERENCES "Entrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
