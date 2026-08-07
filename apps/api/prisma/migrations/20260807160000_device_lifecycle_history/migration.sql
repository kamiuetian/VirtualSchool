CREATE TABLE "DeviceAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "studentId" TEXT,
  "classId" TEXT,
  "branchId" TEXT,
  "reason" TEXT NOT NULL,
  "actorId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "DeviceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceLifecycleEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceAssignment_tenantId_deviceId_startedAt_idx" ON "DeviceAssignment"("tenantId", "deviceId", "startedAt");
CREATE INDEX "DeviceAssignment_tenantId_studentId_startedAt_idx" ON "DeviceAssignment"("tenantId", "studentId", "startedAt");
CREATE INDEX "DeviceAssignment_deviceId_endedAt_idx" ON "DeviceAssignment"("deviceId", "endedAt");
CREATE INDEX "DeviceLifecycleEvent_tenantId_deviceId_createdAt_idx" ON "DeviceLifecycleEvent"("tenantId", "deviceId", "createdAt");
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceLifecycleEvent" ADD CONSTRAINT "DeviceLifecycleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceLifecycleEvent" ADD CONSTRAINT "DeviceLifecycleEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
