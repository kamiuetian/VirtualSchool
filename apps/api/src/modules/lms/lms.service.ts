import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { LmsConnectionSummary, LmsProvider } from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { ConfigureLmsDto, MapLmsCourseDto } from "./lms.dto";

@Injectable()
export class LmsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(tenantId: string): Promise<LmsConnectionSummary[]> {
    const values = await this.prisma.lmsConnection.findMany({
      where: { tenantId },
      include: { courseMappings: { orderBy: { createdAt: "desc" } } },
      orderBy: { provider: "asc" },
    });
    return values.map((value: any) => this.summary(value));
  }
  async configure(tenantId: string, input: ConfigureLmsDto, actorId?: string) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException(
        "Use an ARN, vault://, or secret:// credential reference; credential values are not accepted",
      );
    await this.requireTenant(tenantId);
    const baseUrl = this.httpsUrl(input.baseUrl, "base URL").origin;
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.lmsConnection.upsert({
        where: { tenantId_provider: { tenantId, provider: input.provider } },
        create: {
          tenantId,
          provider: input.provider,
          baseUrl,
          credentialReference: input.credentialReference,
          configuredBy: actorId,
        },
        update: {
          baseUrl,
          credentialReference: input.credentialReference,
          configuredBy: actorId,
          status: "ENABLED",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "lms.configure",
          object: "LmsConnection",
          objectId: saved.id,
          outcome: "ENABLED",
          newValue: {
            provider: input.provider,
            baseUrl,
            credentialReference: input.credentialReference,
          },
        },
      });
    });
    return (await this.list(tenantId)).find(
      (item) => item.provider === input.provider,
    );
  }
  async mapCourse(
    tenantId: string,
    rawProvider: string,
    input: MapLmsCourseDto,
    actorId?: string,
  ) {
    const provider = this.provider(rawProvider);
    const connection = await this.requireConnection(tenantId, provider, true);
    if (
      !(await this.prisma.classSection.findFirst({
        where: { id: input.classId, tenantId },
      }))
    )
      throw new NotFoundException("Class was not found for this tenant");
    const launch = this.httpsUrl(input.launchUrl, "launch URL");
    const base = new URL(connection.baseUrl);
    if (launch.origin !== base.origin)
      throw new BadRequestException(
        "Launch URL must use the configured LMS origin",
      );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saved = await tx.lmsCourseMapping.upsert({
          where: {
            connectionId_classId: {
              connectionId: connection.id,
              classId: input.classId,
            },
          },
          create: {
            tenantId,
            connectionId: connection.id,
            ...input,
            launchUrl: launch.toString(),
          },
          update: { ...input, launchUrl: launch.toString(), enabled: true },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId,
            action: "lms.course_mapping.upsert",
            object: "LmsCourseMapping",
            objectId: saved.id,
            outcome: "MAPPED",
            newValue: {
              provider,
              classId: input.classId,
              externalCourseId: input.externalCourseId,
              launchUrl: launch.toString(),
            },
          },
        });
        return saved;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException(
          "That LMS course is already mapped for this provider",
        );
      throw error;
    }
  }
  async test(tenantId: string, rawProvider: string, actorId?: string) {
    const provider = this.provider(rawProvider);
    const connection = await this.requireConnection(tenantId, provider, false);
    const adapterUrl = process.env.LMS_CONNECTION_TEST_URL;
    if (!adapterUrl)
      throw new ServiceUnavailableException(
        "LMS connection-test adapter is not configured",
      );
    let outcome = "FAILED";
    try {
      const response = await fetch(adapterUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.LMS_CONNECTION_TEST_TOKEN
            ? {
                authorization: `Bearer ${process.env.LMS_CONNECTION_TEST_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          provider,
          baseUrl: connection.baseUrl,
          credentialReference: connection.credentialReference,
        }),
      });
      outcome = response.ok ? "SUCCEEDED" : "FAILED";
    } catch {
      outcome = "FAILED";
    }
    const testedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.lmsConnection.update({
        where: { id: connection.id },
        data: { lastTestedAt: testedAt, lastTestOutcome: outcome },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "lms.connection.test",
          object: "LmsConnection",
          objectId: connection.id,
          outcome,
          newValue: { provider },
        },
      });
    });
    if (outcome === "FAILED")
      throw new ServiceUnavailableException("LMS connection test failed");
    return { outcome, testedAt: testedAt.toISOString() };
  }
  async disable(tenantId: string, rawProvider: string, actorId?: string) {
    const provider = this.provider(rawProvider);
    const connection = await this.requireConnection(tenantId, provider, false);
    await this.prisma.$transaction(async (tx) => {
      await tx.lmsConnection.update({
        where: { id: connection.id },
        data: { status: "DISABLED" },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "lms.disable",
          object: "LmsConnection",
          objectId: connection.id,
          outcome: "DISABLED",
          newValue: { provider, mappingsPreserved: true },
        },
      });
    });
    return (await this.list(tenantId)).find(
      (item) => item.provider === provider,
    );
  }
  private provider(value: string): LmsProvider {
    const provider = value.toUpperCase();
    if (provider !== "MOODLE" && provider !== "CANVAS")
      throw new BadRequestException("Provider must be MOODLE or CANVAS");
    return provider;
  }
  private httpsUrl(value: string, label: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(`Invalid ${label}`);
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new BadRequestException(
        `${label} must be an HTTPS URL without embedded credentials`,
      );
    return url;
  }
  private async requireTenant(tenantId: string) {
    const value = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!value) throw new NotFoundException("Tenant was not found");
    return value;
  }
  private async requireConnection(
    tenantId: string,
    provider: LmsProvider,
    enabled: boolean,
  ) {
    const value = await this.prisma.lmsConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!value || (enabled && value.status !== "ENABLED"))
      throw new BadRequestException(
        `Configure and enable ${provider} for this tenant first`,
      );
    return value;
  }
  private summary(value: any): LmsConnectionSummary {
    return {
      id: value.id,
      provider: value.provider,
      baseUrl: value.baseUrl,
      credentialReference: value.credentialReference,
      status: value.status,
      lastTestedAt: value.lastTestedAt?.toISOString() ?? null,
      lastTestOutcome: value.lastTestOutcome ?? null,
      courseMappings: value.courseMappings.map((item: any) => ({
        id: item.id,
        classId: item.classId,
        externalCourseId: item.externalCourseId,
        displayName: item.displayName,
        launchUrl: item.launchUrl,
        enabled: item.enabled,
      })),
    };
  }
}
