ALTER TABLE "ResellerPartner"
ADD COLUMN "approvedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "primaryColor" TEXT,
ADD COLUMN "accentColor" TEXT,
ADD COLUMN "emailSenderName" TEXT,
ADD COLUMN "emailSenderEmail" TEXT,
ADD COLUMN "brandingUpdatedBy" TEXT;
