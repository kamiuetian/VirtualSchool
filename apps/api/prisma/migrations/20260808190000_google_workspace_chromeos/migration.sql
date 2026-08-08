CREATE TABLE "GoogleWorkspaceConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
  "delegatedAdminEmail" TEXT NOT NULL, "credentialReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AUTHORIZED', "lastValidatedAt" TIMESTAMP(3),
  "lastInventorySyncAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GoogleWorkspaceConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleWorkspaceConnection_tenantId_key" ON "GoogleWorkspaceConnection"("tenantId");
ALTER TABLE "GoogleWorkspaceConnection" ADD CONSTRAINT "GoogleWorkspaceConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GoogleWorkspaceOuMapping" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL,
  "organizationalUnitId" TEXT NOT NULL, "organizationalUnitPath" TEXT NOT NULL,
  "branchId" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleWorkspaceOuMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleWorkspaceOuMapping_tenantId_organizationalUnitId_key" ON "GoogleWorkspaceOuMapping"("tenantId", "organizationalUnitId");
CREATE INDEX "GoogleWorkspaceOuMapping_tenantId_enabled_idx" ON "GoogleWorkspaceOuMapping"("tenantId", "enabled");
ALTER TABLE "GoogleWorkspaceOuMapping" ADD CONSTRAINT "GoogleWorkspaceOuMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleWorkspaceOuMapping" ADD CONSTRAINT "GoogleWorkspaceOuMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleWorkspaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleWorkspaceOuMapping" ADD CONSTRAINT "GoogleWorkspaceOuMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChromeOsDeviceState" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "externalDeviceId" TEXT NOT NULL, "organizationalUnitId" TEXT NOT NULL,
  "kioskStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "managedSessionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "appExtensionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "webPolicyStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChromeOsDeviceState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChromeOsDeviceState_deviceId_key" ON "ChromeOsDeviceState"("deviceId");
CREATE UNIQUE INDEX "ChromeOsDeviceState_tenantId_externalDeviceId_key" ON "ChromeOsDeviceState"("tenantId", "externalDeviceId");
CREATE INDEX "ChromeOsDeviceState_tenantId_organizationalUnitId_idx" ON "ChromeOsDeviceState"("tenantId", "organizationalUnitId");
ALTER TABLE "ChromeOsDeviceState" ADD CONSTRAINT "ChromeOsDeviceState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChromeOsDeviceState" ADD CONSTRAINT "ChromeOsDeviceState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleWorkspaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChromeOsDeviceState" ADD CONSTRAINT "ChromeOsDeviceState_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
