-- CreateTable
CREATE TABLE "SupportNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorEmail" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "severity" TEXT NOT NULL DEFAULT 'S3',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diagnosticRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "resolvedAlertRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "commandHistoryRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "supportNoteRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "exportArtifactRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "auditRetentionDays" INTEGER,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "actorId" TEXT,
    "result" JSONB NOT NULL,
    "cutoffs" JSONB NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportNote_tenantId_deviceId_createdAt_idx" ON "SupportNote"("tenantId", "deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportNote_tenantId_status_severity_idx" ON "SupportNote"("tenantId", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionSettings_tenantId_key" ON "RetentionSettings"("tenantId");

-- CreateIndex
CREATE INDEX "DataRetentionRun_tenantId_createdAt_idx" ON "DataRetentionRun"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DataRetentionRun_tenantId_mode_status_idx" ON "DataRetentionRun"("tenantId", "mode", "status");

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionSettings" ADD CONSTRAINT "RetentionSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRetentionRun" ADD CONSTRAINT "DataRetentionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
