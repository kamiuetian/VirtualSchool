ALTER TABLE "Student" ADD COLUMN "auth0Subject" TEXT;
CREATE UNIQUE INDEX "Student_auth0Subject_key" ON "Student"("auth0Subject");

CREATE TABLE "ByodStudySession" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "classId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "allowedUrls" TEXT[] NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ByodStudySession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ByodSessionParticipant" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "authSubject" TEXT NOT NULL, "consentNoticeId" TEXT NOT NULL, "consentVersion" INTEGER NOT NULL,
  "consentAcceptedAt" TIMESTAMP(3) NOT NULL, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitedAt" TIMESTAMP(3), "exitStatus" TEXT, CONSTRAINT "ByodSessionParticipant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ByodStudySession_tenantId_classId_status_startsAt_endsAt_idx" ON "ByodStudySession"("tenantId", "classId", "status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "ByodSessionParticipant_sessionId_studentId_key" ON "ByodSessionParticipant"("sessionId", "studentId");
CREATE INDEX "ByodSessionParticipant_tenantId_studentId_joinedAt_idx" ON "ByodSessionParticipant"("tenantId", "studentId", "joinedAt");
ALTER TABLE "ByodStudySession" ADD CONSTRAINT "ByodStudySession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByodStudySession" ADD CONSTRAINT "ByodStudySession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ByodSessionParticipant" ADD CONSTRAINT "ByodSessionParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByodSessionParticipant" ADD CONSTRAINT "ByodSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ByodStudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByodSessionParticipant" ADD CONSTRAINT "ByodSessionParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
