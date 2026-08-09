import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  EducationWebhookEventType,
  WebhookEndpointSummary,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ConfigureWebhookEndpointDto,
  RotateWebhookSecretDto,
} from "./dto/webhook.dto";

@Injectable()
export class WebhooksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<WebhookEndpointSummary[]> {
    await this.requireTenant(tenantId);
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      include: {
        deliveries: {
          include: { event: { select: { type: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
      orderBy: { createdAt: "desc" },
      where: { tenantId },
    });
    return endpoints.map((endpoint) => this.summary(endpoint));
  }

  async configure(
    tenantId: string,
    input: ConfigureWebhookEndpointDto,
    actorId?: string,
  ) {
    await this.requireTenant(tenantId);
    this.requireHttps(input.url);
    const endpoint = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.webhookEndpoint.upsert({
        create: {
          tenantId,
          name: input.name.trim(),
          url: input.url,
          eventTypes: [...new Set(input.eventTypes)],
          secretReference: input.secretReference.trim(),
          maxAttempts: input.maxAttempts ?? 3,
        },
        update: {
          url: input.url,
          eventTypes: [...new Set(input.eventTypes)],
          maxAttempts: input.maxAttempts ?? 3,
          enabled: true,
        },
        where: { tenantId_name: { tenantId, name: input.name.trim() } },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "webhook.endpoint.configure",
          object: "WebhookEndpoint",
          objectId: saved.id,
          outcome: "SUCCESS",
          newValue: {
            name: saved.name,
            url: saved.url,
            eventTypes: saved.eventTypes,
            maxAttempts: saved.maxAttempts,
            secretReference: saved.secretReference,
          },
        },
      });
      return saved;
    });
    return endpoint;
  }

  async rotate(
    tenantId: string,
    endpointId: string,
    input: RotateWebhookSecretDto,
    actorId?: string,
  ) {
    await this.requireEndpoint(tenantId, endpointId);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.webhookEndpoint.update({
        data: {
          secretReference: input.secretReference.trim(),
          secretVersion: { increment: 1 },
        },
        where: { id: endpointId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "webhook.secret.rotate",
          object: "WebhookEndpoint",
          objectId: endpointId,
          outcome: "SUCCESS",
          newValue: {
            secretReference: saved.secretReference,
            secretVersion: saved.secretVersion,
          },
        },
      });
      return saved;
    });
  }

  async setEnabled(
    tenantId: string,
    endpointId: string,
    enabled: boolean,
    actorId?: string,
  ) {
    await this.requireEndpoint(tenantId, endpointId);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.webhookEndpoint.update({
        data: { enabled },
        where: { id: endpointId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: enabled
            ? "webhook.endpoint.enable"
            : "webhook.endpoint.disable",
          object: "WebhookEndpoint",
          objectId: endpointId,
          outcome: "SUCCESS",
        },
      });
      return saved;
    });
  }

  async retryDelivery(
    tenantId: string,
    endpointId: string,
    deliveryId: string,
    reason: string,
    actorId?: string,
  ) {
    const retryReason = reason.trim();
    if (retryReason.length < 3)
      throw new BadRequestException("A retry reason is required");
    const endpoint = await this.requireEndpoint(tenantId, endpointId);
    if (!endpoint.enabled)
      throw new BadRequestException(
        "Enable the webhook endpoint before retrying delivery",
      );
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, endpointId, tenantId },
    });
    if (!delivery) throw new NotFoundException("Webhook delivery not found");
    if (delivery.status !== "FAILED")
      throw new BadRequestException(
        "Only failed webhook deliveries can be retried",
      );
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.webhookDelivery.update({
        data: {
          status: "PENDING",
          attemptCount: 0,
          nextAttemptAt: new Date(),
          failureReason: null,
          responseStatus: null,
        },
        where: { id: deliveryId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "webhook.delivery.retry",
          object: "WebhookDelivery",
          objectId: deliveryId,
          outcome: "SUCCESS",
          reason: retryReason,
          newValue: { endpointId, eventId: saved.eventId },
        },
      });
      return saved;
    });
  }

  private requireHttps(value: string) {
    const url = new URL(value);
    if (url.protocol !== "https:")
      throw new Error("Webhook URL must use HTTPS");
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
  }

  private async requireEndpoint(tenantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });
    if (!endpoint) throw new NotFoundException("Webhook endpoint not found");
    return endpoint;
  }

  private summary(endpoint: any): WebhookEndpointSummary {
    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      enabled: endpoint.enabled,
      eventTypes: endpoint.eventTypes as EducationWebhookEventType[],
      secretReference: endpoint.secretReference,
      secretVersion: endpoint.secretVersion,
      maxAttempts: endpoint.maxAttempts,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
      deliveries: endpoint.deliveries.map((delivery: any) => ({
        id: delivery.id,
        eventId: delivery.eventId,
        eventType: delivery.event.type as EducationWebhookEventType,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        responseStatus: delivery.responseStatus,
        failureReason: delivery.failureReason,
        createdAt: delivery.createdAt.toISOString(),
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
        nextAttemptAt: delivery.nextAttemptAt.toISOString(),
        signatureTimestamp: delivery.signatureTimestamp,
      })),
    };
  }
}
