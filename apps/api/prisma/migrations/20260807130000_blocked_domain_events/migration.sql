CREATE TABLE "BlockedDomainEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "policyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedRule" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedDomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlockedDomainEvent_tenantId_occurredAt_idx" ON "BlockedDomainEvent"("tenantId", "occurredAt");
CREATE INDEX "BlockedDomainEvent_tenantId_domain_occurredAt_idx" ON "BlockedDomainEvent"("tenantId", "domain", "occurredAt");
CREATE INDEX "BlockedDomainEvent_policyId_policyVersion_idx" ON "BlockedDomainEvent"("policyId", "policyVersion");
ALTER TABLE "BlockedDomainEvent" ADD CONSTRAINT "BlockedDomainEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedDomainEvent" ADD CONSTRAINT "BlockedDomainEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlockedDomainEvent" ADD CONSTRAINT "BlockedDomainEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
