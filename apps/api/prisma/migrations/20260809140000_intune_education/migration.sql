CREATE TABLE "IntuneConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "entraTenantId" TEXT NOT NULL, "clientId" TEXT NOT NULL,
  "credentialReference" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'AUTHORIZED', "lastValidatedAt" TIMESTAMP(3),
  "lastInventorySyncAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IntuneConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntuneGroupMapping" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "groupId" TEXT NOT NULL,
  "groupName" TEXT NOT NULL, "branchId" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntuneGroupMapping_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntuneDeviceState" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "externalDeviceId" TEXT NOT NULL, "groupId" TEXT NOT NULL, "kioskStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "assessmentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "autopilotStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "appDeploymentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "managementHealthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IntuneDeviceState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntuneConnection_tenantId_key" ON "IntuneConnection"("tenantId");
CREATE UNIQUE INDEX "IntuneGroupMapping_tenantId_groupId_key" ON "IntuneGroupMapping"("tenantId", "groupId");
CREATE INDEX "IntuneGroupMapping_tenantId_enabled_idx" ON "IntuneGroupMapping"("tenantId", "enabled");
CREATE UNIQUE INDEX "IntuneDeviceState_deviceId_key" ON "IntuneDeviceState"("deviceId");
CREATE UNIQUE INDEX "IntuneDeviceState_tenantId_externalDeviceId_key" ON "IntuneDeviceState"("tenantId", "externalDeviceId");
CREATE INDEX "IntuneDeviceState_tenantId_groupId_idx" ON "IntuneDeviceState"("tenantId", "groupId");
ALTER TABLE "IntuneConnection" ADD CONSTRAINT "IntuneConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntuneGroupMapping" ADD CONSTRAINT "IntuneGroupMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntuneGroupMapping" ADD CONSTRAINT "IntuneGroupMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntuneConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntuneGroupMapping" ADD CONSTRAINT "IntuneGroupMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntuneDeviceState" ADD CONSTRAINT "IntuneDeviceState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntuneDeviceState" ADD CONSTRAINT "IntuneDeviceState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntuneConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntuneDeviceState" ADD CONSTRAINT "IntuneDeviceState_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
