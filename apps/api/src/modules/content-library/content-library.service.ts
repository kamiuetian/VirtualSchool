import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ContentLibraryItemSummary,
  ContentLibraryReport,
  ContentLibraryType,
} from "@virtual-school/shared";
import type { ContentLibraryItem } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateContentLibraryItemDto,
  UpdateContentLibraryItemDto,
} from "./content-library.dto";

@Injectable()
export class ContentLibraryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    includeUnavailable = false,
  ): Promise<ContentLibraryItemSummary[]> {
    await this.ensureTenant(tenantId);
    const now = new Date();
    const rows = await this.prisma.contentLibraryItem.findMany({
      where: {
        tenantId,
        ...(includeUnavailable
          ? {}
          : {
              status: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            }),
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
    return rows.map((row) => this.summary(row, now));
  }

  async create(
    tenantId: string,
    input: CreateContentLibraryItemDto,
    actorId?: string,
  ) {
    await this.ensureTenant(tenantId);
    await this.validateClasses(tenantId, input.classIds ?? []);
    await this.validateOffline(tenantId, input);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date())
      throw new BadRequestException("Expiry must be in the future");
    const locator = this.validateLocator(input.type, input.locator);
    const saved = await this.prisma.$transaction(async (tx) => {
      const item = await tx.contentLibraryItem.create({
        data: {
          tenantId,
          title: input.title.trim(),
          description: input.description?.trim(),
          type: input.type,
          category: input.category.trim(),
          locator,
          grades: this.normalized(input.grades),
          subjects: this.normalized(input.subjects),
          classIds: [...new Set(input.classIds ?? [])],
          expiresAt,
          offlineEnabled: input.offlineEnabled ?? false,
          offlineVersion: input.offlineVersion,
          offlineSha256: input.offlineSha256?.toLowerCase(),
          offlineSizeBytes: input.offlineSizeBytes,
          offlinePolicyIds: [...new Set(input.offlinePolicyIds ?? [])],
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "content_library.create",
          object: "ContentLibraryItem",
          objectId: item.id,
          outcome: "ACTIVE",
          newValue: {
            type: item.type,
            category: item.category,
            grades: item.grades,
            subjects: item.subjects,
            classIds: item.classIds,
            expiresAt,
            offlineEnabled: item.offlineEnabled,
            offlineVersion: item.offlineVersion,
            offlinePolicyIds: item.offlinePolicyIds,
          },
        },
      });
      return item;
    });
    return this.summary(saved, new Date());
  }

  async update(
    tenantId: string,
    itemId: string,
    input: UpdateContentLibraryItemDto,
    actorId?: string,
  ) {
    const existing = await this.prisma.contentLibraryItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing)
      throw new NotFoundException("Content library item was not found");
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : existing.expiresAt;
    if (input.status === "ACTIVE" && expiresAt && expiresAt <= new Date())
      throw new BadRequestException("Expired content cannot be activated");
    const saved = await this.prisma.$transaction(async (tx) => {
      const item = await tx.contentLibraryItem.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          ...(input.expiresAt ? { expiresAt } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "content_library.update",
          object: "ContentLibraryItem",
          objectId: item.id,
          outcome: item.status,
          oldValue: { status: existing.status, expiresAt: existing.expiresAt },
          newValue: { status: item.status, expiresAt: item.expiresAt },
        },
      });
      return item;
    });
    return this.summary(saved, new Date());
  }

  async report(tenantId: string): Promise<ContentLibraryReport> {
    const items = await this.list(tenantId, true);
    const now = Date.now();
    const in30Days = now + 30 * 86_400_000;
    const expiredItems = items.filter((item) => item.expired);
    return {
      active: items.filter((item) => item.status === "ACTIVE" && !item.expired)
        .length,
      archived: items.filter((item) => item.status === "ARCHIVED").length,
      expired: expiredItems.length,
      expiringWithin30Days: items.filter(
        (item) =>
          item.status === "ACTIVE" &&
          !item.expired &&
          item.expiresAt &&
          Date.parse(item.expiresAt) <= in30Days,
      ).length,
      expiredItems,
    };
  }

  private async ensureTenant(tenantId: string) {
    if (
      !(await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Tenant was not found");
  }
  private async validateClasses(tenantId: string, classIds: string[]) {
    if (!classIds.length) return;
    const count = await this.prisma.classSection.count({
      where: { tenantId, id: { in: [...new Set(classIds)] }, status: "ACTIVE" },
    });
    if (count !== new Set(classIds).size)
      throw new BadRequestException(
        "Every class scope must be active and belong to the tenant",
      );
  }
  private validateLocator(type: ContentLibraryType, value: string) {
    const locator = value.trim();
    if (type === "APP") {
      if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(locator))
        throw new BadRequestException(
          "App resources require a valid package ID",
        );
      return locator;
    }
    let url: URL;
    try {
      url = new URL(locator);
    } catch {
      throw new BadRequestException(
        "Resource locator must be a valid HTTPS URL",
      );
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new BadRequestException(
        "Resource locator must be HTTPS without credentials",
      );
    return url.toString();
  }
  private async validateOffline(
    tenantId: string,
    input: CreateContentLibraryItemDto,
  ) {
    if (!input.offlineEnabled) return;
    if (!["PDF", "WORKSHEET", "VIDEO"].includes(input.type))
      throw new BadRequestException(
        "Offline packs support PDF, worksheet, and video resources only",
      );
    if (
      !input.offlineVersion ||
      !input.offlineSha256 ||
      !input.offlineSizeBytes
    )
      throw new BadRequestException(
        "Offline resources require version, SHA-256, and size metadata",
      );
    const policyIds = [...new Set(input.offlinePolicyIds ?? [])];
    if (!policyIds.length)
      throw new BadRequestException(
        "Offline resources must be bound to at least one published policy",
      );
    const count = await this.prisma.policy.count({
      where: { id: { in: policyIds }, tenantId, status: "PUBLISHED" },
    });
    if (count !== policyIds.length)
      throw new BadRequestException(
        "Every offline policy must be published and belong to the tenant",
      );
  }
  private normalized(values?: string[]) {
    return [
      ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
    ];
  }
  private summary(
    item: ContentLibraryItem,
    now: Date,
  ): ContentLibraryItemSummary {
    return {
      id: item.id,
      tenantId: item.tenantId,
      title: item.title,
      description: item.description,
      type: item.type as ContentLibraryType,
      category: item.category,
      locator: item.locator,
      grades: item.grades,
      subjects: item.subjects,
      classIds: item.classIds,
      status: item.status as "ACTIVE" | "ARCHIVED",
      expiresAt: item.expiresAt?.toISOString() ?? null,
      expired: !!item.expiresAt && item.expiresAt <= now,
      offlineEnabled: item.offlineEnabled,
      offlineVersion: item.offlineVersion,
      offlineSha256: item.offlineSha256,
      offlineSizeBytes: item.offlineSizeBytes,
      offlinePolicyIds: item.offlinePolicyIds,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
