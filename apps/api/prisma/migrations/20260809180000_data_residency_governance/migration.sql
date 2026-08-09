ALTER TABLE "Tenant"
ADD COLUMN "dataRegion" TEXT NOT NULL DEFAULT 'PK',
ADD COLUMN "allowedRegionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Branch" ADD COLUMN "dataRegion" TEXT;

CREATE INDEX "Branch_tenantId_regionCode_idx" ON "Branch"("tenantId", "regionCode");
CREATE INDEX "Branch_tenantId_dataRegion_idx" ON "Branch"("tenantId", "dataRegion");
