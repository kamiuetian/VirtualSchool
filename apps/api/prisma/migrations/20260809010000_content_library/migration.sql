CREATE TABLE "ContentLibraryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "locator" TEXT NOT NULL,
  "grades" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentLibraryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContentLibraryItem_tenantId_status_expiresAt_idx" ON "ContentLibraryItem"("tenantId", "status", "expiresAt");
CREATE INDEX "ContentLibraryItem_tenantId_category_type_idx" ON "ContentLibraryItem"("tenantId", "category", "type");
ALTER TABLE "ContentLibraryItem" ADD CONSTRAINT "ContentLibraryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
