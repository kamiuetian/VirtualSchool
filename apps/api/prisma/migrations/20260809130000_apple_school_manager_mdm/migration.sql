CREATE TABLE "AppleMdmConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "providerName" TEXT NOT NULL,
  "serverUrl" TEXT NOT NULL, "credentialReference" TEXT NOT NULL, "appleSchoolManagerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AUTHORIZED', "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "certificateExpiresAt" TIMESTAMP(3) NOT NULL, "lastValidatedAt" TIMESTAMP(3),
  "lastInventorySyncAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AppleMdmConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AppleDeviceState" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "externalDeviceId" TEXT NOT NULL, "adeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "supervisionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "restrictionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "appBookStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "managedConfigurationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AppleDeviceState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppleMdmConnection_tenantId_key" ON "AppleMdmConnection"("tenantId");
CREATE UNIQUE INDEX "AppleDeviceState_deviceId_key" ON "AppleDeviceState"("deviceId");
CREATE UNIQUE INDEX "AppleDeviceState_tenantId_externalDeviceId_key" ON "AppleDeviceState"("tenantId", "externalDeviceId");
CREATE INDEX "AppleDeviceState_tenantId_supervisionStatus_idx" ON "AppleDeviceState"("tenantId", "supervisionStatus");
ALTER TABLE "AppleMdmConnection" ADD CONSTRAINT "AppleMdmConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppleDeviceState" ADD CONSTRAINT "AppleDeviceState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppleDeviceState" ADD CONSTRAINT "AppleDeviceState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AppleMdmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppleDeviceState" ADD CONSTRAINT "AppleDeviceState_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
