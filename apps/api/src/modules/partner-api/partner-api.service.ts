import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateMachineCredentialDto,
  RotateMachineCredentialDto,
} from "./partner-api.dto";

@Injectable()
export class PartnerApiService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    await this.requireTenant(tenantId);
    const rows = await this.prisma.machineCredential.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.summary(row));
  }

  async create(
    tenantId: string,
    input: CreateMachineCredentialDto,
    actorId?: string,
  ) {
    await this.requireTenant(tenantId);
    const clientId = randomBytes(12).toString("hex");
    const secret = randomBytes(32).toString("base64url");
    const presentedSecret =
      input.kind === "API_KEY" ? `vsk_${clientId}.${secret}` : secret;
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.machineCredential.create({
        data: {
          tenantId,
          name: input.name.trim(),
          kind: input.kind,
          clientId,
          secretHash: this.hash(presentedSecret),
          scopes: [...new Set(input.scopes)],
          rateLimitPerMinute: input.rateLimitPerMinute ?? 120,
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "machine-credential.create",
          object: "MachineCredential",
          objectId: created.id,
          outcome: "SUCCEEDED",
          newValue: {
            name: created.name,
            kind: created.kind,
            scopes: created.scopes,
            rateLimitPerMinute: created.rateLimitPerMinute,
          },
        },
      });
      return created;
    });
    return { ...this.summary(row), secret: presentedSecret };
  }

  async rotate(
    tenantId: string,
    id: string,
    input: RotateMachineCredentialDto,
    actorId?: string,
  ) {
    const existing = await this.find(tenantId, id);
    if (existing.status !== "ACTIVE")
      throw new BadRequestException("Revoked credentials cannot be rotated");
    const raw = randomBytes(32).toString("base64url");
    const presentedSecret =
      existing.kind === "API_KEY" ? `vsk_${existing.clientId}.${raw}` : raw;
    const graceMinutes = input.graceMinutes ?? 15;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.machineCredential.update({
        where: { id },
        data: {
          previousSecretHash: existing.secretHash,
          previousValidUntil: graceMinutes
            ? new Date(Date.now() + graceMinutes * 60_000)
            : new Date(),
          secretHash: this.hash(presentedSecret),
          rotatedAt: new Date(),
        },
      });
      await tx.machineAccessToken.deleteMany({ where: { credentialId: id } });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "machine-credential.rotate",
          object: "MachineCredential",
          objectId: id,
          outcome: "SUCCEEDED",
          newValue: { graceMinutes },
        },
      });
      return updated;
    });
    return { ...this.summary(row), secret: presentedSecret };
  }

  async revoke(tenantId: string, id: string, actorId?: string) {
    const existing = await this.find(tenantId, id);
    if (existing.status === "REVOKED") return this.summary(existing);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.machineCredential.update({
        where: { id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          previousSecretHash: null,
          previousValidUntil: null,
        },
      });
      await tx.machineAccessToken.deleteMany({ where: { credentialId: id } });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "machine-credential.revoke",
          object: "MachineCredential",
          objectId: id,
          outcome: "SUCCEEDED",
        },
      });
      return updated;
    });
    return this.summary(row);
  }

  async issueToken(clientId: string, secret: string, grantType?: string) {
    if (grantType && grantType !== "client_credentials")
      throw new BadRequestException("Only client_credentials is supported");
    const credential = await this.prisma.machineCredential.findUnique({
      where: { clientId },
    });
    const valid =
      credential?.kind === "OAUTH_CLIENT" &&
      credential.status === "ACTIVE" &&
      (this.safeEqual(this.hash(secret), credential.secretHash) ||
        Boolean(
          credential.previousSecretHash &&
            credential.previousValidUntil &&
            credential.previousValidUntil > new Date() &&
            this.safeEqual(this.hash(secret), credential.previousSecretHash),
        ));
    if (!credential || !valid)
      throw new UnauthorizedException(
        "Client credentials are invalid or revoked",
      );
    const accessToken = `vst_${randomBytes(36).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 3600_000);
    await this.prisma.$transaction([
      this.prisma.machineAccessToken.create({
        data: {
          credentialId: credential.id,
          tokenHash: this.hash(accessToken),
          expiresAt,
        },
      }),
      this.prisma.auditEvent.create({
        data: {
          tenantId: credential.tenantId,
          actorId: `machine:${credential.id}`,
          action: "machine-token.issue",
          object: "MachineCredential",
          objectId: credential.id,
          outcome: "SUCCEEDED",
          newValue: {
            expiresAt: expiresAt.toISOString(),
            scopes: credential.scopes,
          },
        },
      }),
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: credential.scopes.join(" "),
    };
  }

  async sandbox(tenantId: string) {
    await this.requireTenant(tenantId);
    const [tenant, classes, students, devices] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          country: true,
          timezone: true,
          status: true,
        },
      }),
      this.prisma.classSection.findMany({
        where: { tenantId },
        select: { id: true, name: true, grade: true },
        take: 100,
      }),
      this.prisma.student.findMany({
        where: { tenantId },
        select: {
          id: true,
          studentCode: true,
          name: true,
          grade: true,
          section: true,
          status: true,
        },
        take: 100,
      }),
      this.prisma.device.findMany({
        where: { tenantId },
        select: {
          id: true,
          serialNumber: true,
          mdmConnector: true,
          status: true,
          lastCheckInAt: true,
        },
        take: 100,
      }),
    ]);
    return { tenant, classes, students, devices };
  }

  async tenant(tenantId: string, actorId?: string) {
    const value = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        country: true,
        timezone: true,
        language: true,
        status: true,
        dataRegion: true,
      },
    });
    if (!value) throw new NotFoundException("Tenant was not found");
    await this.auditAccess(tenantId, actorId, "tenant");
    return value;
  }
  async roster(tenantId: string, actorId?: string) {
    await this.requireTenant(tenantId);
    const [classes, students] = await Promise.all([
      this.prisma.classSection.findMany({
        where: { tenantId },
        select: { id: true, name: true, grade: true, branchId: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.prisma.student.findMany({
        where: { tenantId },
        select: {
          id: true,
          studentCode: true,
          name: true,
          grade: true,
          section: true,
          status: true,
          branchId: true,
        },
        orderBy: { studentCode: "asc" },
        take: 500,
      }),
    ]);
    await this.auditAccess(tenantId, actorId, "roster");
    return { classes, students };
  }
  async devices(tenantId: string, actorId?: string) {
    await this.requireTenant(tenantId);
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      select: {
        id: true,
        serialNumber: true,
        mdmConnector: true,
        status: true,
        lastCheckInAt: true,
        branchId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    await this.auditAccess(tenantId, actorId, "devices");
    return { devices };
  }

  private async requireTenant(tenantId: string) {
    if (
      !(await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Tenant was not found");
  }
  private async auditAccess(
    tenantId: string,
    actorId: string | undefined,
    resource: string,
  ) {
    if (actorId?.startsWith("machine:"))
      await this.prisma.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "partner-api.read",
          object: "PartnerApiResource",
          objectId: resource,
          outcome: "SUCCEEDED",
        },
      });
  }
  private async find(tenantId: string, id: string) {
    const row = await this.prisma.machineCredential.findFirst({
      where: { id, tenantId },
    });
    if (!row)
      throw new NotFoundException(
        "Machine credential was not found for this tenant",
      );
    return row;
  }
  private summary(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      kind: row.kind,
      clientId: row.clientId,
      scopes: row.scopes,
      rateLimitPerMinute: row.rateLimitPerMinute,
      status: row.status,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      rotatedAt: row.rotatedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
