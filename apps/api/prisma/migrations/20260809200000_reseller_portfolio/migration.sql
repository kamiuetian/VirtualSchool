CREATE TABLE "ResellerPartner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "operatorIds" TEXT[],
  "maxCustomers" INTEGER NOT NULL,
  "allowedPlanKeys" TEXT[],
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerPartner_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResellerCustomer" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "externalRef" TEXT,
  "onboardingState" TEXT NOT NULL DEFAULT 'PROVISIONED',
  "renewalAt" TIMESTAMP(3),
  "provisionedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerCustomer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResellerPartner_status_idx" ON "ResellerPartner"("status");
CREATE UNIQUE INDEX "ResellerCustomer_tenantId_key" ON "ResellerCustomer"("tenantId");
CREATE UNIQUE INDEX "ResellerCustomer_partnerId_externalRef_key" ON "ResellerCustomer"("partnerId", "externalRef");
CREATE INDEX "ResellerCustomer_partnerId_renewalAt_idx" ON "ResellerCustomer"("partnerId", "renewalAt");
ALTER TABLE "ResellerCustomer" ADD CONSTRAINT "ResellerCustomer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ResellerPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResellerCustomer" ADD CONSTRAINT "ResellerCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
