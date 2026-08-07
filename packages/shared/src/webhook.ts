export const educationWebhookEventTypes = [
  "device.offline",
  "mode.changed",
  "policy.failed",
  "exam.started",
  "support_ticket.created",
  "lost_device.reported",
] as const;

export type EducationWebhookEventType =
  (typeof educationWebhookEventTypes)[number];

export type WebhookDeliverySummary = {
  id: string;
  eventId: string;
  eventType: EducationWebhookEventType;
  status: "PENDING" | "DELIVERED" | "FAILED";
  attemptCount: number;
  responseStatus: number | null;
  failureReason: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type WebhookEndpointSummary = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  eventTypes: EducationWebhookEventType[];
  secretReference: string;
  secretVersion: number;
  maxAttempts: number;
  deliveries: WebhookDeliverySummary[];
  createdAt: string;
  updatedAt: string;
};
