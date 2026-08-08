CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "message" TEXT NOT NULL, "targetRoles" TEXT[], "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PilotFeedback" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "role" TEXT NOT NULL,
  "module" TEXT NOT NULL, "severity" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'NEW',
  "summary" TEXT NOT NULL, "context" JSONB, "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_tenantId_startsAt_archivedAt_idx" ON "Announcement"("tenantId", "startsAt", "archivedAt");
CREATE INDEX "PilotFeedback_tenantId_status_severity_idx" ON "PilotFeedback"("tenantId", "status", "severity");
CREATE INDEX "PilotFeedback_tenantId_module_createdAt_idx" ON "PilotFeedback"("tenantId", "module", "createdAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
