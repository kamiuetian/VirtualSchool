CREATE TABLE "QuarterlyBusinessReviewPack" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "quarter" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "generatedBy" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuarterlyBusinessReviewPack_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuarterlyBusinessReviewPack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "QuarterlyBusinessReviewPack_tenantId_generatedAt_idx" ON "QuarterlyBusinessReviewPack"("tenantId", "generatedAt");
CREATE INDEX "QuarterlyBusinessReviewPack_tenantId_quarter_idx" ON "QuarterlyBusinessReviewPack"("tenantId", "quarter");
