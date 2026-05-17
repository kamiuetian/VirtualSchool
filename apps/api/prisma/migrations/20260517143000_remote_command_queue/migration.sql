-- AlterTable
ALTER TABLE "RemoteCommand"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "connectorCommandId" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RemoteCommand_tenantId_deviceId_status_idx" ON "RemoteCommand"("tenantId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "RemoteCommand_tenantId_type_createdAt_idx" ON "RemoteCommand"("tenantId", "type", "createdAt");
