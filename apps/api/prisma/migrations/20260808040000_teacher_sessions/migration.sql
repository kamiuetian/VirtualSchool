CREATE TABLE "TeacherClassAssignment" (
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT,
  CONSTRAINT "TeacherClassAssignment_pkey" PRIMARY KEY ("teacherId", "classId")
);

CREATE TABLE "TeacherSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "TeacherSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherSessionEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "deviceId" TEXT,
  "type" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherSessionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherClassAssignment_tenantId_teacherId_idx" ON "TeacherClassAssignment"("tenantId", "teacherId");
CREATE INDEX "TeacherSession_tenantId_teacherId_startedAt_idx" ON "TeacherSession"("tenantId", "teacherId", "startedAt");
CREATE INDEX "TeacherSession_tenantId_classId_status_idx" ON "TeacherSession"("tenantId", "classId", "status");
CREATE UNIQUE INDEX "TeacherSession_one_active_per_teacher" ON "TeacherSession"("tenantId", "teacherId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "TeacherSession_one_active_per_class" ON "TeacherSession"("tenantId", "classId") WHERE "status" = 'ACTIVE';
CREATE INDEX "TeacherSessionEvent_tenantId_sessionId_createdAt_idx" ON "TeacherSessionEvent"("tenantId", "sessionId", "createdAt");

ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherSessionEvent" ADD CONSTRAINT "TeacherSessionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSessionEvent" ADD CONSTRAINT "TeacherSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TeacherSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSessionEvent" ADD CONSTRAINT "TeacherSessionEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
