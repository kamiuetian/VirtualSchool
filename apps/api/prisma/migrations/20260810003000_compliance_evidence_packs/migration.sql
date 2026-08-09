CREATE TABLE "ComplianceEvidencePack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "windowFrom" TIMESTAMP(3) NOT NULL,
    "windowTo" TIMESTAMP(3) NOT NULL,
    "sections" JSONB NOT NULL,
    "artifact" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceEvidencePack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComplianceEvidencePack_tenantId_createdAt_idx" ON "ComplianceEvidencePack"("tenantId", "createdAt");

ALTER TABLE "ComplianceEvidencePack" ADD CONSTRAINT "ComplianceEvidencePack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
