CREATE TABLE "PolicyRecommendation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "policyId" TEXT,
  "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL, "proposedChange" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3), "decidedBy" TEXT, "decisionReason" TEXT,
  CONSTRAINT "PolicyRecommendation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PolicyRecommendation_tenantId_status_generatedAt_idx" ON "PolicyRecommendation"("tenantId", "status", "generatedAt");
CREATE INDEX "PolicyRecommendation_tenantId_policyId_idx" ON "PolicyRecommendation"("tenantId", "policyId");

CREATE TABLE "SecurityAnomalyAlert" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "category" TEXT NOT NULL, "severity" TEXT NOT NULL, "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL, "evidence" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT, "resolvedAt" TIMESTAMP(3), "resolvedBy" TEXT, "resolutionNote" TEXT,
  CONSTRAINT "SecurityAnomalyAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityAnomalyAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SecurityAnomalyAlert_tenantId_fingerprint_key" ON "SecurityAnomalyAlert"("tenantId", "fingerprint");
CREATE INDEX "SecurityAnomalyAlert_tenantId_status_severity_detectedAt_idx" ON "SecurityAnomalyAlert"("tenantId", "status", "severity", "detectedAt");
