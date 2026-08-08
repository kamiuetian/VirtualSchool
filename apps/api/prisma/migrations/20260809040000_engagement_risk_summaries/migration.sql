ALTER TABLE "NotificationPreference"
ADD COLUMN "engagementRiskEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "missedSessionThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "complianceFailureThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "weeklyAdminSummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "weeklyGuardianSummaryEnabled" BOOLEAN NOT NULL DEFAULT false;
