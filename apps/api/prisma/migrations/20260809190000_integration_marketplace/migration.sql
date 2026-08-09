CREATE TABLE "IntegrationSubmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewNotes" TEXT,
  "submittedBy" TEXT,
  "reviewedBy" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationInstallation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ENABLED',
  "configuration" JSONB,
  "lastTestStatus" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "enabledBy" TEXT,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationSubmission_tenantId_slug_version_key" ON "IntegrationSubmission"("tenantId", "slug", "version");
CREATE INDEX "IntegrationSubmission_tenantId_status_createdAt_idx" ON "IntegrationSubmission"("tenantId", "status", "createdAt");
CREATE INDEX "IntegrationSubmission_status_publishedAt_idx" ON "IntegrationSubmission"("status", "publishedAt");
CREATE UNIQUE INDEX "IntegrationInstallation_tenantId_submissionId_key" ON "IntegrationInstallation"("tenantId", "submissionId");
CREATE INDEX "IntegrationInstallation_tenantId_status_idx" ON "IntegrationInstallation"("tenantId", "status");
ALTER TABLE "IntegrationSubmission" ADD CONSTRAINT "IntegrationSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationInstallation" ADD CONSTRAINT "IntegrationInstallation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationInstallation" ADD CONSTRAINT "IntegrationInstallation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "IntegrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
