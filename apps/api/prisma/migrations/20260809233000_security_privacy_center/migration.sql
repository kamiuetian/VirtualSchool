CREATE TABLE "SecurityPrivacyProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentContactName" TEXT NOT NULL,
    "incidentContactEmail" TEXT NOT NULL,
    "incidentContactPhone" TEXT,
    "policyDocuments" JSONB NOT NULL,
    "childSafetyGuardrails" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityPrivacyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecurityPrivacyProfile_tenantId_key" ON "SecurityPrivacyProfile"("tenantId");
ALTER TABLE "SecurityPrivacyProfile" ADD CONSTRAINT "SecurityPrivacyProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
