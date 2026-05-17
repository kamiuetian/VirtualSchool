CREATE TABLE "TimetableBlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "policyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "classId" TEXT,
    "grade" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "timezone" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimetableBlock_tenantId_active_dayOfWeek_idx" ON "TimetableBlock"("tenantId", "active", "dayOfWeek");
CREATE INDEX "TimetableBlock_tenantId_scope_scopeId_idx" ON "TimetableBlock"("tenantId", "scope", "scopeId");
CREATE INDEX "TimetableBlock_tenantId_classId_idx" ON "TimetableBlock"("tenantId", "classId");
CREATE INDEX "TimetableBlock_policyId_idx" ON "TimetableBlock"("policyId");

ALTER TABLE "TimetableBlock" ADD CONSTRAINT "TimetableBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableBlock" ADD CONSTRAINT "TimetableBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableBlock" ADD CONSTRAINT "TimetableBlock_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableBlock" ADD CONSTRAINT "TimetableBlock_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
