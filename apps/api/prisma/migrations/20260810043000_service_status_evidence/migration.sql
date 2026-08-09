CREATE TABLE "ServiceStatusIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedModules" TEXT[],
    "summary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceStatusIncident_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceMaintenanceWindow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "affectedModules" TEXT[],
    "summary" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceMaintenanceWindow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DisasterRecoveryEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rpoMinutes" INTEGER NOT NULL,
    "rtoMinutes" INTEGER NOT NULL,
    "exerciseDate" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "eligiblePlans" TEXT[],
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisasterRecoveryEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceStatusIncident_tenantId_status_startedAt_idx" ON "ServiceStatusIncident"("tenantId", "status", "startedAt");
CREATE INDEX "ServiceMaintenanceWindow_tenantId_startsAt_endsAt_idx" ON "ServiceMaintenanceWindow"("tenantId", "startsAt", "endsAt");
CREATE INDEX "DisasterRecoveryEvidence_tenantId_exerciseDate_idx" ON "DisasterRecoveryEvidence"("tenantId", "exerciseDate");
ALTER TABLE "ServiceStatusIncident" ADD CONSTRAINT "ServiceStatusIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceMaintenanceWindow" ADD CONSTRAINT "ServiceMaintenanceWindow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisasterRecoveryEvidence" ADD CONSTRAINT "DisasterRecoveryEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
