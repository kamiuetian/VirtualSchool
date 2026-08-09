CREATE TABLE "ProcurementBatch" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "vendor" TEXT NOT NULL, "purchaseDate" TIMESTAMP(3) NOT NULL,
  "expectedDevices" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PURCHASED',
  "shippingCarrier" TEXT, "trackingNumber" TEXT, "destination" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurementBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProcurementDevice" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "batchId" TEXT NOT NULL,
  "deviceId" TEXT, "serialNumber" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PURCHASED',
  "rmaNumber" TEXT, "rmaReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurementDevice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DeviceCustodyEvent" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "fromHolder" TEXT, "toHolder" TEXT, "location" TEXT, "reason" TEXT NOT NULL,
  "reference" TEXT, "actorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceCustodyEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DeviceReplacement" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "originalDeviceId" TEXT NOT NULL,
  "replacementDeviceId" TEXT NOT NULL, "reason" TEXT NOT NULL, "rmaNumber" TEXT,
  "actorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceReplacement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcurementBatch_tenantId_reference_key" ON "ProcurementBatch"("tenantId", "reference");
CREATE INDEX "ProcurementBatch_tenantId_status_createdAt_idx" ON "ProcurementBatch"("tenantId", "status", "createdAt");
CREATE UNIQUE INDEX "ProcurementDevice_deviceId_key" ON "ProcurementDevice"("deviceId");
CREATE UNIQUE INDEX "ProcurementDevice_tenantId_serialNumber_key" ON "ProcurementDevice"("tenantId", "serialNumber");
CREATE INDEX "ProcurementDevice_tenantId_batchId_status_idx" ON "ProcurementDevice"("tenantId", "batchId", "status");
CREATE INDEX "DeviceCustodyEvent_tenantId_deviceId_createdAt_idx" ON "DeviceCustodyEvent"("tenantId", "deviceId", "createdAt");
CREATE INDEX "DeviceReplacement_tenantId_originalDeviceId_createdAt_idx" ON "DeviceReplacement"("tenantId", "originalDeviceId", "createdAt");
CREATE INDEX "DeviceReplacement_tenantId_replacementDeviceId_createdAt_idx" ON "DeviceReplacement"("tenantId", "replacementDeviceId", "createdAt");
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementDevice" ADD CONSTRAINT "ProcurementDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementDevice" ADD CONSTRAINT "ProcurementDevice_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcurementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementDevice" ADD CONSTRAINT "ProcurementDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceCustodyEvent" ADD CONSTRAINT "DeviceCustodyEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceCustodyEvent" ADD CONSTRAINT "DeviceCustodyEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacement" ADD CONSTRAINT "DeviceReplacement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacement" ADD CONSTRAINT "DeviceReplacement_originalDeviceId_fkey" FOREIGN KEY ("originalDeviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacement" ADD CONSTRAINT "DeviceReplacement_replacementDeviceId_fkey" FOREIGN KEY ("replacementDeviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
