CREATE TABLE "RemoteAssistanceSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "ticketId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "purpose" TEXT NOT NULL,
  "visibleNotice" TEXT NOT NULL,
  "consentedBy" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "startedBy" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedBy" TEXT,
  "endedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RemoteAssistanceSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RemoteAssistanceSession_tenantId_deviceId_startedAt_idx" ON "RemoteAssistanceSession"("tenantId", "deviceId", "startedAt");
CREATE INDEX "RemoteAssistanceSession_tenantId_status_startedAt_idx" ON "RemoteAssistanceSession"("tenantId", "status", "startedAt");
CREATE UNIQUE INDEX "RemoteAssistanceSession_one_active_device_idx" ON "RemoteAssistanceSession"("tenantId", "deviceId") WHERE "status" = 'ACTIVE';
ALTER TABLE "RemoteAssistanceSession" ADD CONSTRAINT "RemoteAssistanceSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemoteAssistanceSession" ADD CONSTRAINT "RemoteAssistanceSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
