import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  EducationConnectionSummary,
  EducationProvider,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  educationProviders,
  type ConfigureEducationConnectionDto,
  type MapEducationResourceDto,
} from "./education-resources.dto";

const allowedHosts: Record<EducationProvider, string[]> = {
  MICROSOFT_365: [
    "office.com",
    "www.office.com",
    "microsoft365.com",
    "www.microsoft365.com",
    "sharepoint.com",
  ],
  TEAMS: ["teams.microsoft.com", "teams.live.com"],
  ZOOM: ["zoom.us"],
  GOOGLE_MEET: ["meet.google.com"],
};

@Injectable()
export class EducationResourcesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(tenantId: string): Promise<EducationConnectionSummary[]> {
    const rows = await this.prisma.educationConnection.findMany({
      where: { tenantId },
      include: { resources: { orderBy: { createdAt: "desc" } } },
      orderBy: { provider: "asc" },
    });
    return rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      credentialReference: row.credentialReference,
      status: row.status,
      resources: row.resources.map((item: any) => ({
        id: item.id,
        classId: item.classId,
        provider: item.provider,
        externalId: item.externalId,
        displayName: item.displayName,
        launchUrl: item.launchUrl,
        enabled: item.enabled,
      })),
    }));
  }
  async configure(
    tenantId: string,
    input: ConfigureEducationConnectionDto,
    actorId?: string,
  ) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException(
        "Use a secret reference; credential values are not accepted",
      );
    if (!(await this.prisma.tenant.findUnique({ where: { id: tenantId } })))
      throw new NotFoundException("Tenant was not found");
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.educationConnection.upsert({
        where: { tenantId_provider: { tenantId, provider: input.provider } },
        create: { tenantId, ...input, configuredBy: actorId },
        update: {
          credentialReference: input.credentialReference,
          configuredBy: actorId,
          status: "ENABLED",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "education_connection.configure",
          object: "EducationConnection",
          objectId: saved.id,
          outcome: "ENABLED",
          newValue: {
            provider: input.provider,
            credentialReference: input.credentialReference,
          },
        },
      });
    });
    return (await this.list(tenantId)).find(
      (item) => item.provider === input.provider,
    );
  }
  async map(
    tenantId: string,
    connectionProvider: string,
    input: MapEducationResourceDto,
    actorId?: string,
  ) {
    const provider = this.provider(connectionProvider);
    if (input.provider !== provider && provider !== "MICROSOFT_365")
      throw new BadRequestException(
        "Resource provider must match its connection",
      );
    if (
      provider === "MICROSOFT_365" &&
      !["MICROSOFT_365", "TEAMS"].includes(input.provider)
    )
      throw new BadRequestException(
        "Microsoft 365 connections accept only Microsoft 365 or Teams resources",
      );
    const connection = await this.prisma.educationConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!connection || connection.status !== "ENABLED")
      throw new BadRequestException(`Configure and enable ${provider} first`);
    if (
      !(await this.prisma.classSection.findFirst({
        where: { id: input.classId, tenantId, status: "ACTIVE" },
      }))
    )
      throw new NotFoundException("Active class was not found for this tenant");
    const launchUrl = this.validatedUrl(input.provider, input.launchUrl);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saved = await tx.educationResource.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: input.externalId,
            },
          },
          create: {
            tenantId,
            connectionId: connection.id,
            ...input,
            launchUrl,
          },
          update: { ...input, launchUrl, enabled: true },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId,
            action: "education_resource.upsert",
            object: "EducationResource",
            objectId: saved.id,
            outcome: "APPROVED",
            newValue: {
              provider: input.provider,
              classId: input.classId,
              externalId: input.externalId,
              launchUrl,
            },
          },
        });
        return saved;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException("Resource is already mapped");
      throw error;
    }
  }
  private provider(value: string): EducationProvider {
    const provider = value.toUpperCase() as EducationProvider;
    if (!educationProviders.includes(provider))
      throw new BadRequestException("Unsupported education provider");
    return provider;
  }
  private validatedUrl(provider: EducationProvider, value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("Invalid launch URL");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new BadRequestException(
        "Launch URL must be HTTPS without embedded credentials",
      );
    const hostname = url.hostname.toLowerCase();
    if (
      !allowedHosts[provider].some(
        (host) =>
          hostname === host ||
          (host === "zoom.us" && hostname.endsWith(".zoom.us")) ||
          (host === "sharepoint.com" && hostname.endsWith(".sharepoint.com")),
      )
    )
      throw new BadRequestException(
        `Launch URL is not an approved ${provider} host`,
      );
    return url.toString();
  }
}
