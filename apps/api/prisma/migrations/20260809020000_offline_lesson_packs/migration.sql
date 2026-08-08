ALTER TABLE "ContentLibraryItem"
ADD COLUMN "offlineEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "offlineVersion" INTEGER,
ADD COLUMN "offlineSha256" TEXT,
ADD COLUMN "offlineSizeBytes" INTEGER,
ADD COLUMN "offlinePolicyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ContentLibraryItem_tenantId_offlineEnabled_status_idx"
ON "ContentLibraryItem"("tenantId", "offlineEnabled", "status");
