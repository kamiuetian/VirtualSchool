ALTER TABLE "EnrollmentBatch"
  ADD COLUMN "providerTokenName" TEXT;

CREATE UNIQUE INDEX "EnrollmentBatch_providerTokenName_key"
  ON "EnrollmentBatch"("providerTokenName");
