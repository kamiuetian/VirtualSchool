import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  NotificationDeliverySummary,
  NotificationPreferenceSummary,
} from "@virtual-school/shared";
import type {
  NotificationDelivery,
  NotificationPreference,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPreferences(
    tenantId: string,
  ): Promise<NotificationPreferenceSummary> {
    await this.ensureTenant(tenantId);
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { tenantId },
    });
    return this.toPreference(preference, tenantId);
  }

  async updatePreferences(
    tenantId: string,
    input: UpdateNotificationPreferenceDto,
    actorId: string | undefined,
  ): Promise<NotificationPreferenceSummary> {
    await this.ensureTenant(tenantId);
    const previous = await this.prisma.notificationPreference.findUnique({
      where: { tenantId },
    });
    const recipients = input.recipients
      ? [
          ...new Set(
            input.recipients.map((email) => email.trim().toLowerCase()),
          ),
        ]
      : undefined;
    const saved = await this.prisma.$transaction(async (tx) => {
      const preference = await tx.notificationPreference.upsert({
        create: {
          ...input,
          recipients: recipients ?? [],
          tenantId,
          updatedBy: actorId,
        },
        update: { ...input, recipients, updatedBy: actorId },
        where: { tenantId },
      });
      await tx.auditEvent.create({
        data: {
          action: "notification_preference.update",
          actorId,
          newValue: this.auditValue(preference),
          object: "NotificationPreference",
          objectId: preference.id,
          oldValue: previous ? this.auditValue(previous) : undefined,
          outcome: "UPDATED",
          tenantId,
        },
      });
      return preference;
    });
    return this.toPreference(saved, tenantId);
  }

  async listDeliveries(
    tenantId: string,
    limit = 50,
  ): Promise<NotificationDeliverySummary[]> {
    await this.ensureTenant(tenantId);
    const deliveries = await this.prisma.notificationDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit || 50, 1), 200),
      where: { tenantId },
    });
    return deliveries.map((item) => this.toDelivery(item));
  }

  private async ensureTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: { id: true },
      where: { id: tenantId },
    });
    if (!tenant)
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
  }

  private toPreference(
    value: NotificationPreference | null,
    tenantId: string,
  ): NotificationPreferenceSummary {
    return {
      appFailureEnabled: value?.appFailureEnabled ?? true,
      deduplicationWindowMinutes: value?.deduplicationWindowMinutes ?? 60,
      engagementRiskEnabled: value?.engagementRiskEnabled ?? true,
      missedSessionThreshold: value?.missedSessionThreshold ?? 3,
      complianceFailureThreshold: value?.complianceFailureThreshold ?? 3,
      weeklyAdminSummaryEnabled: value?.weeklyAdminSummaryEnabled ?? true,
      weeklyGuardianSummaryEnabled: value?.weeklyGuardianSummaryEnabled ?? false,
      lostDeviceEnabled: value?.lostDeviceEnabled ?? true,
      offlineAfterMinutes: value?.offlineAfterMinutes ?? 60,
      offlineEnabled: value?.offlineEnabled ?? true,
      policyFailureEnabled: value?.policyFailureEnabled ?? true,
      recipients: value?.recipients ?? [],
      repeatedEnrollmentEnabled: value?.repeatedEnrollmentEnabled ?? true,
      repeatedEnrollmentThreshold: value?.repeatedEnrollmentThreshold ?? 3,
      tenantId,
      updatedAt: value?.updatedAt.toISOString() ?? null,
      updatedBy: value?.updatedBy ?? null,
    };
  }

  private auditValue(value: NotificationPreference) {
    const {
      id: _id,
      tenantId: _tenantId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...safe
    } = value;
    return safe;
  }

  private toDelivery(item: NotificationDelivery): NotificationDeliverySummary {
    return {
      alertId: item.alertId,
      attemptCount: item.attemptCount,
      channel: "EMAIL",
      createdAt: item.createdAt.toISOString(),
      deliveredAt: item.deliveredAt?.toISOString() ?? null,
      failureReason: item.failureReason,
      id: item.id,
      provider: item.provider,
      providerId: item.providerId,
      recipient: item.recipient,
      status: item.status as NotificationDeliverySummary["status"],
    };
  }
}
