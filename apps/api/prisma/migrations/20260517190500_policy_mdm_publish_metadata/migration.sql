ALTER TABLE "Policy"
  ADD COLUMN "mdmPolicyName" TEXT,
  ADD COLUMN "mdmPublishStatus" TEXT,
  ADD COLUMN "mdmPublishedAt" TIMESTAMP(3),
  ADD COLUMN "mdmPublishError" TEXT,
  ADD COLUMN "mdmPublishRequest" JSONB,
  ADD COLUMN "mdmPublishResponse" JSONB;

CREATE INDEX "Policy_tenantId_mdmPublishStatus_idx" ON "Policy"("tenantId", "mdmPublishStatus");
