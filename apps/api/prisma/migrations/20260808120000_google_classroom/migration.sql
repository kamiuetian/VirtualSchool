CREATE TABLE "ClassroomConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "credentialReference" TEXT NOT NULL,
  "delegatedAdminEmail" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'AUTHORIZED',
  "lastValidatedAt" TIMESTAMP(3), "authorizedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ClassroomConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassroomCourseMapping" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "classId" TEXT NOT NULL,
  "externalCourseId" TEXT NOT NULL, "externalCourseName" TEXT, "syncRoster" BOOLEAN NOT NULL DEFAULT true,
  "syncMaterials" BOOLEAN NOT NULL DEFAULT false, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassroomCourseMapping_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassroomIdentityMapping" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "localType" TEXT NOT NULL,
  "localId" TEXT NOT NULL, "externalUserId" TEXT NOT NULL, "externalEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassroomIdentityMapping_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassroomSyncRun" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL,
  "requestedCourseIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "syncRoster" BOOLEAN NOT NULL, "syncMaterials" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED', "attempt" INTEGER NOT NULL DEFAULT 1, "retryOfId" TEXT,
  "outcome" JSONB, "errorCode" TEXT, "errorMessage" TEXT, "requestedBy" TEXT,
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ClassroomSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassroomConnection_tenantId_key" ON "ClassroomConnection"("tenantId");
CREATE UNIQUE INDEX "ClassroomCourseMapping_tenantId_classId_key" ON "ClassroomCourseMapping"("tenantId", "classId");
CREATE UNIQUE INDEX "ClassroomCourseMapping_tenantId_externalCourseId_key" ON "ClassroomCourseMapping"("tenantId", "externalCourseId");
CREATE INDEX "ClassroomCourseMapping_connectionId_enabled_idx" ON "ClassroomCourseMapping"("connectionId", "enabled");
CREATE UNIQUE INDEX "ClassroomIdentityMapping_tenantId_localType_localId_key" ON "ClassroomIdentityMapping"("tenantId", "localType", "localId");
CREATE UNIQUE INDEX "ClassroomIdentityMapping_tenantId_externalUserId_key" ON "ClassroomIdentityMapping"("tenantId", "externalUserId");
CREATE INDEX "ClassroomIdentityMapping_connectionId_localType_idx" ON "ClassroomIdentityMapping"("connectionId", "localType");
CREATE INDEX "ClassroomSyncRun_tenantId_createdAt_idx" ON "ClassroomSyncRun"("tenantId", "createdAt");
CREATE INDEX "ClassroomSyncRun_connectionId_status_idx" ON "ClassroomSyncRun"("connectionId", "status");
ALTER TABLE "ClassroomConnection" ADD CONSTRAINT "ClassroomConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomCourseMapping" ADD CONSTRAINT "ClassroomCourseMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomCourseMapping" ADD CONSTRAINT "ClassroomCourseMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClassroomConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomIdentityMapping" ADD CONSTRAINT "ClassroomIdentityMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomIdentityMapping" ADD CONSTRAINT "ClassroomIdentityMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClassroomConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomSyncRun" ADD CONSTRAINT "ClassroomSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomSyncRun" ADD CONSTRAINT "ClassroomSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClassroomConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
