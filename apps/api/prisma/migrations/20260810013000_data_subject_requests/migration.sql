CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requestType" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', "retentionUntil" TIMESTAMP(3),
    "requestedBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3), "result" JSONB, "artifact" JSONB, "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataLegalHold" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdBy" TEXT,
    "releasedBy" TEXT, "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataLegalHold_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataSubjectRequest_tenantId_status_createdAt_idx" ON "DataSubjectRequest"("tenantId", "status", "createdAt");
CREATE INDEX "DataSubjectRequest_tenantId_subjectType_subjectId_idx" ON "DataSubjectRequest"("tenantId", "subjectType", "subjectId");
CREATE INDEX "DataLegalHold_tenantId_subjectType_subjectId_releasedAt_idx" ON "DataLegalHold"("tenantId", "subjectType", "subjectId", "releasedAt");
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataLegalHold" ADD CONSTRAINT "DataLegalHold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
