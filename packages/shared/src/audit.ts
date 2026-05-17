export type AuditEventSummary = {
  id: string;
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  object: string;
  objectId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  reason?: string | null;
  outcome: string;
  createdAt: string;
};

export type AuditEventList = {
  items: AuditEventSummary[];
  page: {
    limit: number;
    offset: number;
    total: number;
  };
};
