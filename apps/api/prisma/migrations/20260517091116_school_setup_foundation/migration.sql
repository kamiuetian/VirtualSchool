-- CreateTable
CREATE TABLE "EnrollmentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "enrolledCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCatalogItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "category" TEXT,
    "iconUrl" TEXT,
    "description" TEXT,
    "approvedGrades" TEXT[],
    "installRules" JSONB,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentBatch_token_key" ON "EnrollmentBatch"("token");

-- CreateIndex
CREATE INDEX "EnrollmentBatch_tenantId_createdAt_idx" ON "EnrollmentBatch"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AppCatalogItem_tenantId_approvalStatus_idx" ON "AppCatalogItem"("tenantId", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AppCatalogItem_tenantId_packageId_key" ON "AppCatalogItem"("tenantId", "packageId");

-- AddForeignKey
ALTER TABLE "EnrollmentBatch" ADD CONSTRAINT "EnrollmentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppCatalogItem" ADD CONSTRAINT "AppCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
