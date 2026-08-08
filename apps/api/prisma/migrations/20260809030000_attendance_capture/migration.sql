CREATE TABLE "AttendanceSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionSignalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deviceSignalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lmsSignalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "teacherSignalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "presentThreshold" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendanceDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "derivedStatus" TEXT NOT NULL,
    "signals" JSONB NOT NULL,
    "correctedBy" TEXT,
    "correctionReason" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceSettings_tenantId_key" ON "AttendanceSettings"("tenantId");
CREATE UNIQUE INDEX "AttendanceRecord_tenantId_classId_studentId_attendanceDate_key" ON "AttendanceRecord"("tenantId", "classId", "studentId", "attendanceDate");
CREATE INDEX "AttendanceRecord_tenantId_attendanceDate_idx" ON "AttendanceRecord"("tenantId", "attendanceDate");
CREATE INDEX "AttendanceRecord_tenantId_classId_attendanceDate_idx" ON "AttendanceRecord"("tenantId", "classId", "attendanceDate");
ALTER TABLE "AttendanceSettings" ADD CONSTRAINT "AttendanceSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
