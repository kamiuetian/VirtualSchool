CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT, "studentId" TEXT,
  "classId" TEXT, "sessionId" TEXT, "source" TEXT NOT NULL DEFAULT 'STAFF',
  "category" TEXT NOT NULL DEFAULT 'GENERAL', "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN', "subject" TEXT NOT NULL, "description" TEXT NOT NULL,
  "assigneeId" TEXT, "routingQueue" TEXT NOT NULL, "slaDueAt" TIMESTAMP(3) NOT NULL,
  "firstResponseAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3), "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupportTicketNote" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "ticketId" TEXT NOT NULL, "authorId" TEXT,
  "authorEmail" TEXT, "visibility" TEXT NOT NULL DEFAULT 'INTERNAL', "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_tenantId_status_priority_slaDueAt_idx" ON "SupportTicket"("tenantId", "status", "priority", "slaDueAt");
CREATE INDEX "SupportTicket_tenantId_deviceId_createdAt_idx" ON "SupportTicket"("tenantId", "deviceId", "createdAt");
CREATE INDEX "SupportTicket_tenantId_assigneeId_status_idx" ON "SupportTicket"("tenantId", "assigneeId", "status");
CREATE INDEX "SupportTicketNote_tenantId_ticketId_createdAt_idx" ON "SupportTicketNote"("tenantId", "ticketId", "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianSupportRequest" ADD COLUMN "supportTicketId" TEXT;
CREATE UNIQUE INDEX "GuardianSupportRequest_supportTicketId_key" ON "GuardianSupportRequest"("supportTicketId");
