CREATE TABLE "EnterpriseIdentityConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "protocol" TEXT NOT NULL,
  "issuer" TEXT NOT NULL, "clientId" TEXT, "metadataUrl" TEXT,
  "credentialReference" TEXT NOT NULL, "scimTokenReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "breakGlassUserId" TEXT NOT NULL,
  "lastValidatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseIdentityConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScimGroupRoleMapping" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL,
  "externalGroup" TEXT NOT NULL, "role" TEXT NOT NULL, "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScimGroupRoleMapping_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "User" ADD COLUMN "scimExternalId" TEXT;
ALTER TABLE "User" ADD COLUMN "scimConnectionId" TEXT;
CREATE UNIQUE INDEX "EnterpriseIdentityConnection_tenantId_key" ON "EnterpriseIdentityConnection"("tenantId");
CREATE UNIQUE INDEX "ScimGroupRoleMapping_tenantId_externalGroup_key" ON "ScimGroupRoleMapping"("tenantId", "externalGroup");
CREATE INDEX "ScimGroupRoleMapping_tenantId_role_idx" ON "ScimGroupRoleMapping"("tenantId", "role");
CREATE UNIQUE INDEX "User_tenantId_scimExternalId_key" ON "User"("tenantId", "scimExternalId");
ALTER TABLE "EnterpriseIdentityConnection" ADD CONSTRAINT "EnterpriseIdentityConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIdentityConnection" ADD CONSTRAINT "EnterpriseIdentityConnection_breakGlassUserId_fkey" FOREIGN KEY ("breakGlassUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScimGroupRoleMapping" ADD CONSTRAINT "ScimGroupRoleMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupRoleMapping" ADD CONSTRAINT "ScimGroupRoleMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "EnterpriseIdentityConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupRoleMapping" ADD CONSTRAINT "ScimGroupRoleMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_scimConnectionId_fkey" FOREIGN KEY ("scimConnectionId") REFERENCES "EnterpriseIdentityConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
