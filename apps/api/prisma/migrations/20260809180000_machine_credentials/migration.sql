CREATE TABLE "MachineCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "previousSecretHash" TEXT,
  "previousValidUntil" TIMESTAMP(3),
  "scopes" TEXT[],
  "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "rotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MachineCredential_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MachineAccessToken" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineAccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineCredential_clientId_key" ON "MachineCredential"("clientId");
CREATE INDEX "MachineCredential_tenantId_status_idx" ON "MachineCredential"("tenantId", "status");
CREATE UNIQUE INDEX "MachineAccessToken_tokenHash_key" ON "MachineAccessToken"("tokenHash");
CREATE INDEX "MachineAccessToken_credentialId_expiresAt_idx" ON "MachineAccessToken"("credentialId", "expiresAt");
ALTER TABLE "MachineCredential" ADD CONSTRAINT "MachineCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineAccessToken" ADD CONSTRAINT "MachineAccessToken_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "MachineCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
