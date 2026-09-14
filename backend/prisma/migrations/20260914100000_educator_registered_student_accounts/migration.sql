-- Educator-registered student accounts:
-- Students are created by educators, log in with email + password
-- (passwordHash + JWT), and receive an email invitation to set that
-- password (invitationToken + invitationExpiresAt). clerkUserId becomes
-- nullable because educator-created students have no Clerk account.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "invitationToken" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "clerkUserId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_invitationToken_key" ON "User"("invitationToken");
