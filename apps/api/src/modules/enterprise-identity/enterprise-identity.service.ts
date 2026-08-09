import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ConfigureEnterpriseIdentityDto,
  MapScimGroupDto,
  ScimLifecycleDto,
} from "./enterprise-identity.dto";

const referencePattern = /^(arn:|vault:\/\/|secret:\/\/)/;
@Injectable()
export class EnterpriseIdentityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async get(tenantId: string) {
    return this.prisma.enterpriseIdentityConnection.findUnique({
      where: { tenantId },
      include: { groupMappings: { orderBy: { externalGroup: "asc" } } },
    });
  }
  async configure(
    tenantId: string,
    input: ConfigureEnterpriseIdentityDto,
    actorId?: string,
  ) {
    if (
      !referencePattern.test(input.credentialReference) ||
      !referencePattern.test(input.scimTokenReference)
    )
      throw new BadRequestException(
        "SSO credentials and SCIM tokens must use an ARN, vault://, or secret:// reference",
      );
    if (input.protocol === "SAML" && !input.metadataUrl)
      throw new BadRequestException(
        "SAML configuration requires an HTTPS metadata URL",
      );
    if (input.protocol === "OIDC" && !input.clientId)
      throw new BadRequestException("OIDC configuration requires a client ID");
    const breakGlass = await this.prisma.user.findFirst({
      where: { id: input.breakGlassUserId, tenantId, scimExternalId: null },
    });
    if (
      !breakGlass ||
      breakGlass.status !== "ACTIVE" ||
      !breakGlass.mfaEnabled ||
      !["SCHOOL_ADMIN", "IT_ADMIN"].includes(breakGlass.role)
    )
      throw new BadRequestException(
        "Break-glass access requires an active, MFA-enabled tenant administrator",
      );
    const saved = await this.prisma.$transaction(async (tx) => {
      const value = await tx.enterpriseIdentityConnection.upsert({
        where: { tenantId },
        create: { tenantId, ...input, lastValidatedAt: new Date() },
        update: { ...input, status: "ACTIVE", lastValidatedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "enterprise_identity.configure",
          object: "EnterpriseIdentityConnection",
          objectId: value.id,
          outcome: "ACTIVE",
          newValue: {
            protocol: input.protocol,
            issuer: input.issuer,
            clientId: input.clientId,
            metadataUrl: input.metadataUrl,
            credentialReference: input.credentialReference,
            scimTokenReference: input.scimTokenReference,
            breakGlassUserId: input.breakGlassUserId,
          },
        },
      });
      return value;
    });
    return saved;
  }
  async mapGroup(tenantId: string, input: MapScimGroupDto, actorId?: string) {
    const connection = await this.requireConnection(tenantId);
    if (
      input.branchId &&
      !(await this.prisma.branch.findFirst({
        where: { id: input.branchId, tenantId },
      }))
    )
      throw new NotFoundException("Branch was not found for this tenant");
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.scimGroupRoleMapping.upsert({
        where: {
          tenantId_externalGroup: {
            tenantId,
            externalGroup: input.externalGroup,
          },
        },
        create: { tenantId, connectionId: connection.id, ...input },
        update: {
          connectionId: connection.id,
          role: input.role,
          branchId: input.branchId ?? null,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "scim.group_role_mapping.upsert",
          object: "ScimGroupRoleMapping",
          objectId: value.id,
          outcome: "MAPPED",
          newValue: {
            externalGroup: input.externalGroup,
            role: input.role,
            branchId: input.branchId,
          },
        },
      });
      return value;
    });
  }
  async provisionUser(
    tenantId: string,
    input: ScimLifecycleDto,
    actorId?: string,
  ) {
    const connection = await this.requireConnection(tenantId);
    const mappings = await this.prisma.scimGroupRoleMapping.findMany({
      where: { tenantId, externalGroup: { in: [...new Set(input.groups)] } },
    });
    if (mappings.length !== 1)
      throw new BadRequestException(
        "SCIM user must resolve to exactly one tenant group-to-role mapping",
      );
    const mapping = mappings[0]!;
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_scimExternalId: { tenantId, scimExternalId: input.externalId },
      },
    });
    if (input.operation === "CREATE" && existing)
      throw new ConflictException(
        "SCIM external ID already exists for this tenant",
      );
    if (input.operation !== "CREATE" && !existing)
      throw new NotFoundException("SCIM user was not found for this tenant");
    const disabling =
      input.operation === "SUSPEND" ||
      input.operation === "DELETE" ||
      input.active === false;
    return this.prisma.$transaction(async (tx) => {
      const value = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              email,
              name: input.name,
              role: mapping.role,
              branchId: mapping.branchId,
              status: disabling ? "DEACTIVATED" : "ACTIVE",
              deactivatedAt: disabling ? new Date() : null,
              suspendedAt: input.operation === "SUSPEND" ? new Date() : null,
              forcedLogoutAt: disabling ? new Date() : undefined,
              lastRoleChangedAt:
                existing.role !== mapping.role ? new Date() : undefined,
            },
          })
        : await tx.user.create({
            data: {
              tenantId,
              email,
              name: input.name,
              role: mapping.role,
              branchId: mapping.branchId,
              status: input.active === false ? "DEACTIVATED" : "ACTIVE",
              scimExternalId: input.externalId,
              scimConnectionId: connection.id,
              invitedBy: actorId,
            },
          });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: `scim.user.${input.operation.toLowerCase()}`,
          object: "User",
          objectId: value.id,
          outcome: value.status,
          reason: input.reason,
          oldValue: existing
            ? {
                email: existing.email,
                role: existing.role,
                status: existing.status,
                branchId: existing.branchId,
              }
            : undefined,
          newValue: {
            externalId: input.externalId,
            email: value.email,
            role: value.role,
            status: value.status,
            branchId: value.branchId,
          },
        },
      });
      return value;
    });
  }
  private async requireConnection(tenantId: string) {
    const value = await this.prisma.enterpriseIdentityConnection.findUnique({
      where: { tenantId },
    });
    if (!value || value.status !== "ACTIVE")
      throw new BadRequestException(
        "Configure active enterprise identity for this tenant first",
      );
    return value;
  }
}
