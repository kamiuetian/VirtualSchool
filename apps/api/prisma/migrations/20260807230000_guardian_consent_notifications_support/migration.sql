CREATE TABLE "GuardianNotificationPreference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "channels" TEXT[] DEFAULT ARRAY['EMAIL']::TEXT[],
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardianSupportRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "routedTo" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianSupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianNotificationPreference_guardianId_key" ON "GuardianNotificationPreference"("guardianId");
CREATE INDEX "GuardianNotificationPreference_tenantId_guardianId_idx" ON "GuardianNotificationPreference"("tenantId", "guardianId");
CREATE INDEX "GuardianSupportRequest_tenantId_status_createdAt_idx" ON "GuardianSupportRequest"("tenantId", "status", "createdAt");
CREATE INDEX "GuardianSupportRequest_tenantId_guardianId_studentId_idx" ON "GuardianSupportRequest"("tenantId", "guardianId", "studentId");
ALTER TABLE "GuardianNotificationPreference" ADD CONSTRAINT "GuardianNotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianNotificationPreference" ADD CONSTRAINT "GuardianNotificationPreference_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianSupportRequest" ADD CONSTRAINT "GuardianSupportRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianSupportRequest" ADD CONSTRAINT "GuardianSupportRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianSupportRequest" ADD CONSTRAINT "GuardianSupportRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianSupportRequest" ADD CONSTRAINT "GuardianSupportRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
