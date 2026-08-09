import { createHmac } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { EducationWebhookEventType } from "@virtual-school/shared";
import { WorkerPrismaService } from "../prisma/worker-prisma.service";

const auditEventTypes: Record<string, EducationWebhookEventType> = {
  "device_alert.offline_scan": "device.offline",
  "teacher_session.start": "mode.changed",
  "teacher_session.end": "mode.changed",
  "policy.mdm_publish_fail": "policy.failed",
  "exam.schedule": "exam.started",
  "guardian.support_request.create": "support_ticket.created",
  "guardian.device.report_lost": "lost_device.reported",
};

@Injectable()
export class WebhookDeliveryService {
  constructor(
    @Inject(WorkerPrismaService) private readonly prisma: WorkerPrismaService,
  ) {}

  async processTenant(tenantId: string): Promise<Record<string, unknown>> {
    const created = await this.captureEvents(tenantId);
    const deliveries = await this.prisma.webhookDelivery.findMany({
      include: { endpoint: true, event: true },
      orderBy: { createdAt: "asc" },
      take: this.envInt("WORKER_WEBHOOK_BATCH_SIZE", 100),
      where: {
        tenantId,
        status: { in: ["PENDING", "FAILED"] },
        nextAttemptAt: { lte: new Date() },
        endpoint: { enabled: true },
      },
    });
    let delivered = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      if (delivery.attemptCount >= delivery.endpoint.maxAttempts) continue;
      const result = await this.send(
        delivery.endpoint,
        delivery.event,
        delivery.id,
        delivery.attemptCount + 1,
      );
      const attemptCount = delivery.attemptCount + 1;
      const terminal =
        !result.retryable || attemptCount >= delivery.endpoint.maxAttempts;
      await this.prisma.$transaction(async (tx) => {
        await tx.webhookDelivery.update({
          data: {
            attemptCount,
            deliveredAt: result.delivered ? new Date() : null,
            failureReason: result.failureReason,
            lastAttemptAt: new Date(),
            nextAttemptAt:
              result.delivered || terminal
                ? new Date("9999-12-31T00:00:00.000Z")
                : new Date(
                    Date.now() + Math.min(300_000, 2 ** attemptCount * 1_000),
                  ),
            responseStatus: result.responseStatus,
            signatureTimestamp: result.timestamp,
            status: result.delivered ? "DELIVERED" : "FAILED",
          },
          where: { id: delivery.id },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId: "worker",
            action: "webhook.delivery.attempt",
            object: "WebhookDelivery",
            objectId: delivery.id,
            outcome: result.delivered ? "DELIVERED" : "FAILED",
            newValue: {
              attemptCount,
              endpointId: delivery.endpointId,
              eventId: delivery.eventId,
              eventType: delivery.event.type,
              responseStatus: result.responseStatus,
            },
          },
        });
      });
      if (result.delivered) delivered += 1;
      else failed += 1;
    }
    return {
      capturedEvents: created,
      delivered,
      failed,
      job: "webhooks.dispatch",
      tenantId,
    };
  }

  private async captureEvents(tenantId: string): Promise<number> {
    const audits = await this.prisma.auditEvent.findMany({
      orderBy: { createdAt: "asc" },
      take: this.envInt("WORKER_WEBHOOK_CAPTURE_BATCH_SIZE", 250),
      where: {
        tenantId,
        action: { in: Object.keys(auditEventTypes) },
        webhookEvent: null,
      },
    });
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { enabled: true, tenantId },
    });
    let created = 0;
    for (const audit of audits) {
      const type = auditEventTypes[audit.action];
      if (!type) continue;
      await this.prisma.$transaction(async (tx) => {
        const event = await tx.webhookEvent.create({
          data: {
            tenantId,
            sourceAuditId: audit.id,
            type,
            objectType: audit.object,
            objectId: audit.objectId,
            occurredAt:
              type === "exam.started"
                ? (this.examStart(audit) ?? audit.createdAt)
                : audit.createdAt,
            payload: this.safePayload(type, audit) as any,
          },
        });
        const subscribed = endpoints.filter((endpoint) =>
          endpoint.eventTypes.includes(type),
        );
        if (subscribed.length)
          await tx.webhookDelivery.createMany({
            data: subscribed.map((endpoint) => ({
              tenantId,
              endpointId: endpoint.id,
              eventId: event.id,
              nextAttemptAt: event.occurredAt,
            })),
          });
      });
      created += 1;
    }
    return created;
  }

  private async send(
    endpoint: any,
    event: any,
    deliveryId: string,
    attempt: number,
  ) {
    const secret = this.secrets()[endpoint.secretReference];
    const timestamp = String(Math.floor(Date.now() / 1000));
    if (!secret)
      return {
        delivered: false,
        failureReason:
          "Signing secret reference is not available to the worker",
        retryable: false,
        timestamp,
      };
    const body = JSON.stringify({
      apiVersion: "2026-08-01",
      id: event.id,
      delivery: { id: deliveryId, attempt },
      occurredAt: event.occurredAt.toISOString(),
      tenantId: event.tenantId,
      tenant: { id: event.tenantId },
      type: event.type,
      object: { id: event.objectId, type: event.objectType },
      data: event.payload,
    });
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    try {
      const response = await fetch(endpoint.url, {
        body,
        method: "POST",
        signal: AbortSignal.timeout(
          this.envInt("WEBHOOK_DELIVERY_TIMEOUT_MS", 10_000),
        ),
        headers: {
          "Content-Type": "application/json",
          "X-VirtualSchool-Event-Id": event.id,
          "X-VirtualSchool-Delivery-Id": deliveryId,
          "X-VirtualSchool-Signature": `v1=${signature}`,
          "X-VirtualSchool-Signature-Version": String(endpoint.secretVersion),
          "X-VirtualSchool-Timestamp": timestamp,
        },
      });
      return {
        delivered: response.ok,
        failureReason: response.ok
          ? undefined
          : `Endpoint returned HTTP ${response.status}`,
        responseStatus: response.status,
        retryable:
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
        timestamp,
      };
    } catch (error) {
      return {
        delivered: false,
        failureReason:
          error instanceof Error ? error.message : "Webhook request failed",
        retryable: true,
        timestamp,
      };
    }
  }

  private safePayload(type: EducationWebhookEventType, audit: any) {
    const value = (audit.newValue ?? {}) as Record<string, unknown>;
    const allowed: Record<EducationWebhookEventType, string[]> = {
      "device.offline": [
        "alertsCreatedOrUpdated",
        "evaluatedDevices",
        "offlineAfterMinutes",
      ],
      "mode.changed": ["classId", "sessionId", "status", "mode"],
      "policy.failed": ["connector", "mdmPolicyName", "mdmPublishStatus"],
      "exam.started": [
        "policyId",
        "policyVersion",
        "scope",
        "scopeId",
        "startsAt",
        "endsAt",
      ],
      "support_ticket.created": [
        "studentId",
        "deviceId",
        "category",
        "priority",
      ],
      "lost_device.reported": ["alertId", "studentId", "lostWorkflowStarted"],
    };
    const payload = Object.fromEntries(
      allowed[type]
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, value[key]]),
    );
    if (type === "policy.failed" && audit.reason)
      payload.failureReason = audit.reason;
    return payload;
  }
  private examStart(audit: any): Date | null {
    const startsAt = (audit.newValue as any)?.startsAt;
    if (startsAt instanceof Date) return startsAt;
    if (typeof startsAt !== "string") return null;
    const value = new Date(startsAt);
    return Number.isNaN(value.getTime()) ? null : value;
  }
  private secrets(): Record<string, string> {
    try {
      const value = JSON.parse(
        process.env.WEBHOOK_SIGNING_SECRETS_JSON ?? "{}",
      ) as unknown;
      return value && typeof value === "object"
        ? (value as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  }
  private envInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
