CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offlineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "offlineAfterMinutes" INTEGER NOT NULL DEFAULT 60,
    "policyFailureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "appFailureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lostDeviceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "repeatedEnrollmentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "repeatedEnrollmentThreshold" INTEGER NOT NULL DEFAULT 3,
    "deduplicationWindowMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_tenantId_key" ON "NotificationPreference"("tenantId");
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");
CREATE UNIQUE INDEX "NotificationDelivery_alertId_recipient_channel_key" ON "NotificationDelivery"("alertId", "recipient", "channel");
CREATE INDEX "NotificationDelivery_tenantId_status_createdAt_idx" ON "NotificationDelivery"("tenantId", "status", "createdAt");
CREATE INDEX "NotificationDelivery_tenantId_alertId_idx" ON "NotificationDelivery"("tenantId", "alertId");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DeviceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
