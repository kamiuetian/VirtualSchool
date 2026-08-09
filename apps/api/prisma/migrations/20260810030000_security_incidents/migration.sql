CREATE TABLE "SecurityIncident" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "classification" TEXT NOT NULL, "severity" TEXT NOT NULL, "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "ownerId" TEXT NOT NULL, "evidence" JSONB NOT NULL,
  "reportedBy" TEXT, "closedBy" TEXT, "closedAt" TIMESTAMP(3), "closureSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "SecurityIncidentUpdate" (
  "id" TEXT NOT NULL, "incidentId" TEXT NOT NULL, "updateType" TEXT NOT NULL,
  "summary" TEXT NOT NULL, "evidence" JSONB NOT NULL, "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityIncidentUpdate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityIncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SecurityIncident_tenantId_status_createdAt_idx" ON "SecurityIncident"("tenantId", "status", "createdAt");
CREATE INDEX "SecurityIncident_tenantId_severity_createdAt_idx" ON "SecurityIncident"("tenantId", "severity", "createdAt");
CREATE INDEX "SecurityIncidentUpdate_incidentId_createdAt_idx" ON "SecurityIncidentUpdate"("incidentId", "createdAt");
