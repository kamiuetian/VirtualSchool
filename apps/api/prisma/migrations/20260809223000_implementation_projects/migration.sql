CREATE TABLE "ImplementationProject" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNING',
  "ownerIds" TEXT[],
  "targetGoLiveAt" TIMESTAMP(3),
  "milestones" JSONB NOT NULL DEFAULT '[]',
  "risks" JSONB NOT NULL DEFAULT '[]',
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "decisions" JSONB NOT NULL DEFAULT '[]',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImplementationProject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImplementationProjectEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImplementationProjectEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImplementationProject_customerId_key" ON "ImplementationProject"("customerId");
CREATE UNIQUE INDEX "ImplementationProject_tenantId_key" ON "ImplementationProject"("tenantId");
CREATE INDEX "ImplementationProject_partnerId_status_targetGoLiveAt_idx" ON "ImplementationProject"("partnerId", "status", "targetGoLiveAt");
CREATE INDEX "ImplementationProject_tenantId_status_idx" ON "ImplementationProject"("tenantId", "status");
CREATE INDEX "ImplementationProjectEvent_projectId_createdAt_idx" ON "ImplementationProjectEvent"("projectId", "createdAt");
ALTER TABLE "ImplementationProject" ADD CONSTRAINT "ImplementationProject_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ResellerPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImplementationProject" ADD CONSTRAINT "ImplementationProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ResellerCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImplementationProject" ADD CONSTRAINT "ImplementationProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImplementationProjectEvent" ADD CONSTRAINT "ImplementationProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
