CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "conditions" JSONB NOT NULL,
  "action" TEXT NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AutomationExecution" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutomationRule_tenantId_enabled_trigger_idx" ON "AutomationRule"("tenantId", "enabled", "trigger");
CREATE UNIQUE INDEX "AutomationExecution_ruleId_fingerprint_key" ON "AutomationExecution"("ruleId", "fingerprint");
CREATE INDEX "AutomationExecution_tenantId_createdAt_idx" ON "AutomationExecution"("tenantId", "createdAt");
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
