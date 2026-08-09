CREATE TABLE "AnalyticsExportSchedule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "partnerId" TEXT,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "destinationType" TEXT NOT NULL,
  "destinationReference" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsExportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsExportRun" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "tenantId" TEXT,
  "status" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AnalyticsExportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsExportSchedule_enabled_nextRunAt_idx" ON "AnalyticsExportSchedule"("enabled", "nextRunAt");
CREATE INDEX "AnalyticsExportSchedule_tenantId_createdAt_idx" ON "AnalyticsExportSchedule"("tenantId", "createdAt");
CREATE INDEX "AnalyticsExportSchedule_partnerId_createdAt_idx" ON "AnalyticsExportSchedule"("partnerId", "createdAt");
CREATE INDEX "AnalyticsExportRun_scheduleId_startedAt_idx" ON "AnalyticsExportRun"("scheduleId", "startedAt");
CREATE INDEX "AnalyticsExportRun_tenantId_startedAt_idx" ON "AnalyticsExportRun"("tenantId", "startedAt");
ALTER TABLE "AnalyticsExportSchedule" ADD CONSTRAINT "AnalyticsExportSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsExportSchedule" ADD CONSTRAINT "AnalyticsExportSchedule_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ResellerPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsExportRun" ADD CONSTRAINT "AnalyticsExportRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AnalyticsExportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsExportRun" ADD CONSTRAINT "AnalyticsExportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsExportSchedule" ADD CONSTRAINT "AnalyticsExportSchedule_owner_check" CHECK (("tenantId" IS NOT NULL) <> ("partnerId" IS NOT NULL));
