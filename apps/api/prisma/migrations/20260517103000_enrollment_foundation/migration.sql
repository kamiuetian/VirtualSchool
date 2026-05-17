-- CreateEnum
CREATE TYPE "EnrollmentBatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "EnrollmentBatch"
  ADD COLUMN "status" "EnrollmentBatchStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "maxDevices" INTEGER,
  ADD COLUMN "qrPayload" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Device"
  ADD COLUMN "enrollmentBatchId" TEXT,
  ADD COLUMN "ownershipType" TEXT NOT NULL DEFAULT 'SCHOOL_OWNED',
  ADD COLUMN "health" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "compliance" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "EnrollmentBatch_tenantId_status_idx" ON "EnrollmentBatch"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Device_tenantId_enrollmentBatchId_idx" ON "Device"("tenantId", "enrollmentBatchId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_enrollmentBatchId_fkey" FOREIGN KEY ("enrollmentBatchId") REFERENCES "EnrollmentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
