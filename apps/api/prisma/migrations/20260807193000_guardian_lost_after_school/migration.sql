CREATE TABLE "GuardianAfterSchoolControl" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "dailyLimitMinutes" INTEGER NOT NULL DEFAULT 60,
  "allowedAppIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianAfterSchoolControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianAfterSchoolControl_guardianId_studentId_key" ON "GuardianAfterSchoolControl"("guardianId", "studentId");
CREATE INDEX "GuardianAfterSchoolControl_tenantId_studentId_idx" ON "GuardianAfterSchoolControl"("tenantId", "studentId");
ALTER TABLE "GuardianAfterSchoolControl" ADD CONSTRAINT "GuardianAfterSchoolControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianAfterSchoolControl" ADD CONSTRAINT "GuardianAfterSchoolControl_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianAfterSchoolControl" ADD CONSTRAINT "GuardianAfterSchoolControl_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
