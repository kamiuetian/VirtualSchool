CREATE TABLE "EducationConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "credentialReference" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ENABLED',
  "configuredBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EducationConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EducationResource" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL, "launchUrl" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EducationResource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EducationConnection_tenantId_provider_key" ON "EducationConnection"("tenantId", "provider");
CREATE INDEX "EducationConnection_tenantId_status_idx" ON "EducationConnection"("tenantId", "status");
CREATE UNIQUE INDEX "EducationResource_connectionId_externalId_key" ON "EducationResource"("connectionId", "externalId");
CREATE INDEX "EducationResource_tenantId_classId_enabled_idx" ON "EducationResource"("tenantId", "classId", "enabled");
ALTER TABLE "EducationConnection" ADD CONSTRAINT "EducationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationResource" ADD CONSTRAINT "EducationResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationResource" ADD CONSTRAINT "EducationResource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "EducationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
