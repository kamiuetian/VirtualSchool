CREATE TABLE "DeviceDiagnostic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "batteryLevel" INTEGER,
    "storageFreeMb" INTEGER,
    "networkStatus" TEXT,
    "launcherVersion" TEXT,
    "browserVersion" TEXT,
    "mdmPolicyName" TEXT,
    "policyVersion" INTEGER,
    "health" TEXT,
    "compliance" TEXT,
    "details" JSONB,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceDiagnostic_tenantId_deviceId_reportedAt_idx" ON "DeviceDiagnostic"("tenantId", "deviceId", "reportedAt");
CREATE INDEX "DeviceDiagnostic_tenantId_reportedAt_idx" ON "DeviceDiagnostic"("tenantId", "reportedAt");
CREATE INDEX "DeviceAlert_tenantId_status_severity_idx" ON "DeviceAlert"("tenantId", "status", "severity");
CREATE INDEX "DeviceAlert_tenantId_deviceId_status_idx" ON "DeviceAlert"("tenantId", "deviceId", "status");
CREATE INDEX "DeviceAlert_tenantId_type_status_idx" ON "DeviceAlert"("tenantId", "type", "status");

ALTER TABLE "DeviceDiagnostic" ADD CONSTRAINT "DeviceDiagnostic_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceAlert" ADD CONSTRAINT "DeviceAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
