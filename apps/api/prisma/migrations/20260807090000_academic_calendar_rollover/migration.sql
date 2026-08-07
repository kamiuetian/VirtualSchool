ALTER TABLE "ClassSection"
ADD COLUMN "academicYear" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "sourceClassId" TEXT;

CREATE TABLE "AcademicCalendarException" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "policyId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'TENANT',
  "scopeId" TEXT,
  "localDate" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "startMinute" INTEGER,
  "endMinute" INTEGER,
  "timezone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "actorId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicCalendarException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassSection_tenantId_academicYear_status_idx" ON "ClassSection"("tenantId", "academicYear", "status");
CREATE INDEX "ClassSection_sourceClassId_idx" ON "ClassSection"("sourceClassId");
CREATE INDEX "AcademicCalendarException_tenantId_localDate_active_idx" ON "AcademicCalendarException"("tenantId", "localDate", "active");
CREATE INDEX "AcademicCalendarException_tenantId_scope_scopeId_idx" ON "AcademicCalendarException"("tenantId", "scope", "scopeId");
CREATE INDEX "AcademicCalendarException_policyId_idx" ON "AcademicCalendarException"("policyId");
ALTER TABLE "ClassSection" ADD CONSTRAINT "ClassSection_sourceClassId_fkey" FOREIGN KEY ("sourceClassId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicCalendarException" ADD CONSTRAINT "AcademicCalendarException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicCalendarException" ADD CONSTRAINT "AcademicCalendarException_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
