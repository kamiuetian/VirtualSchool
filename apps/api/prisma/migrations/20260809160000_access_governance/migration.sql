ALTER TABLE "Branch" ADD COLUMN "regionCode" TEXT;

CREATE TABLE "AccessRoleTemplate" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "permissions" JSONB NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessRoleTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccessAssignment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "templateId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL, "regionCodes" JSONB NOT NULL, "branchId" TEXT, "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3), "revokedReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AccessAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccessReview" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AccessReview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccessReviewItem" (
  "id" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'PENDING', "reason" TEXT, "decidedBy" TEXT, "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AccessReviewItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessRoleTemplate_tenantId_name_key" ON "AccessRoleTemplate"("tenantId", "name");
CREATE INDEX "AccessRoleTemplate_tenantId_active_idx" ON "AccessRoleTemplate"("tenantId", "active");
CREATE INDEX "AccessAssignment_tenantId_userId_revokedAt_idx" ON "AccessAssignment"("tenantId", "userId", "revokedAt");
CREATE INDEX "AccessAssignment_tenantId_scopeType_idx" ON "AccessAssignment"("tenantId", "scopeType");
CREATE INDEX "AccessReview_tenantId_status_dueAt_idx" ON "AccessReview"("tenantId", "status", "dueAt");
CREATE UNIQUE INDEX "AccessReviewItem_reviewId_assignmentId_key" ON "AccessReviewItem"("reviewId", "assignmentId");
CREATE INDEX "AccessReviewItem_reviewId_decision_idx" ON "AccessReviewItem"("reviewId", "decision");
ALTER TABLE "AccessRoleTemplate" ADD CONSTRAINT "AccessRoleTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AccessRoleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessReview" ADD CONSTRAINT "AccessReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AccessReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AccessAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
