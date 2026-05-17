-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "invitedBy" TEXT,
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "forcedLogoutAt" TIMESTAMP(3),
  ADD COLUMN "lastRoleChangedAt" TIMESTAMP(3);
