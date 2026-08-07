CREATE TABLE "TeacherSessionTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "resourceId" TEXT,
  "focusMessage" TEXT,
  "focusDurationMinutes" INTEGER,
  "temporaryUrl" TEXT,
  "temporaryUrlMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherSessionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherSessionTemplate_tenantId_teacherId_name_key" ON "TeacherSessionTemplate"("tenantId", "teacherId", "name");
CREATE INDEX "TeacherSessionTemplate_tenantId_teacherId_classId_idx" ON "TeacherSessionTemplate"("tenantId", "teacherId", "classId");
ALTER TABLE "TeacherSessionTemplate" ADD CONSTRAINT "TeacherSessionTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSessionTemplate" ADD CONSTRAINT "TeacherSessionTemplate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSessionTemplate" ADD CONSTRAINT "TeacherSessionTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
