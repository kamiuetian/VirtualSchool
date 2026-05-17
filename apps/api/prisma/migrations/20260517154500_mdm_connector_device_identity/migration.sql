-- AlterTable
ALTER TABLE "Device"
  ADD COLUMN "mdmConnector" TEXT NOT NULL DEFAULT 'ANDROID_MANAGEMENT_API',
  ADD COLUMN "connectorDeviceName" TEXT;

-- CreateIndex
CREATE INDEX "Device_tenantId_mdmConnector_idx" ON "Device"("tenantId", "mdmConnector");
