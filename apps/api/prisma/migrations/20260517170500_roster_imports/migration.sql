-- CreateTable
CREATE TABLE "RosterImport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "filename" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "errorReportCsv" TEXT,
  "committedAt" TIMESTAMP(3),
  "committedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterImport_tenantId_createdAt_idx" ON "RosterImport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterImport_tenantId_status_idx" ON "RosterImport"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
