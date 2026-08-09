CREATE TABLE "BackupVerification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "backupType" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "backupReference" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "backupCreatedAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "expectedIntervalHours" INTEGER NOT NULL,
  "retentionUntil" TIMESTAMP(3),
  "evidenceUrl" TEXT NOT NULL,
  "notes" TEXT,
  "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestoreDrill" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "backupVerificationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "runbookUrl" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "outcome" TEXT,
  "resultSummary" TEXT,
  "evidenceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestoreDrill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupVerification_tenantId_backupType_verifiedAt_idx" ON "BackupVerification"("tenantId", "backupType", "verifiedAt");
CREATE INDEX "BackupVerification_tenantId_status_backupCreatedAt_idx" ON "BackupVerification"("tenantId", "status", "backupCreatedAt");
CREATE INDEX "RestoreDrill_tenantId_status_createdAt_idx" ON "RestoreDrill"("tenantId", "status", "createdAt");
CREATE INDEX "RestoreDrill_backupVerificationId_createdAt_idx" ON "RestoreDrill"("backupVerificationId", "createdAt");
ALTER TABLE "BackupVerification" ADD CONSTRAINT "BackupVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestoreDrill" ADD CONSTRAINT "RestoreDrill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestoreDrill" ADD CONSTRAINT "RestoreDrill_backupVerificationId_fkey" FOREIGN KEY ("backupVerificationId") REFERENCES "BackupVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
