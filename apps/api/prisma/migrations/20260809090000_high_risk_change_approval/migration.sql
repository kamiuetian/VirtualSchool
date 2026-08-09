CREATE TABLE "HighRiskApprovalConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "enabledOperations" JSONB NOT NULL,
  "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HighRiskApprovalConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HighRiskApprovalConfig_tenantId_key" ON "HighRiskApprovalConfig"("tenantId");
CREATE INDEX "HighRiskApprovalConfig_tenantId_idx" ON "HighRiskApprovalConfig"("tenantId");

CREATE TABLE "HighRiskChangeRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "summary" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "decisions" JSONB NOT NULL,
  "outcome" TEXT,
  "decidedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HighRiskChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HighRiskChangeRequest_tenantId_status_createdAt_idx" ON "HighRiskChangeRequest"("tenantId", "status", "createdAt");
CREATE INDEX "HighRiskChangeRequest_tenantId_objectType_objectId_idx" ON "HighRiskChangeRequest"("tenantId", "objectType", "objectId");
