CREATE TABLE "PrivacyNotice" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "noticeType" TEXT NOT NULL,
  "channel" TEXT NOT NULL, "version" INTEGER NOT NULL, "title" TEXT NOT NULL,
  "content" TEXT NOT NULL, "publishedBy" TEXT, "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacyNotice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivacyNotice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PrivacyAcceptance" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "noticeId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "channel" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyAcceptance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivacyAcceptance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivacyAcceptance_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "PrivacyNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrivacyNotice_tenantId_noticeType_channel_version_key" ON "PrivacyNotice"("tenantId", "noticeType", "channel", "version");
CREATE INDEX "PrivacyNotice_tenantId_noticeType_channel_publishedAt_idx" ON "PrivacyNotice"("tenantId", "noticeType", "channel", "publishedAt");
CREATE UNIQUE INDEX "PrivacyAcceptance_noticeId_subjectType_subjectId_channel_key" ON "PrivacyAcceptance"("noticeId", "subjectType", "subjectId", "channel");
CREATE INDEX "PrivacyAcceptance_tenantId_subjectType_subjectId_acceptedAt_idx" ON "PrivacyAcceptance"("tenantId", "subjectType", "subjectId", "acceptedAt");
