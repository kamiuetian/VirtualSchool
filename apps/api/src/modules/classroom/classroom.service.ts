import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ClassroomConnectionSummary,
  ClassroomSyncRunSummary,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthorizeClassroomDto,
  MapClassroomCourseDto,
  MapClassroomIdentityDto,
  StartClassroomSyncDto,
} from "./dto/classroom.dto";

@Injectable()
export class ClassroomService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<ClassroomConnectionSummary | null> {
    const value = await this.prisma.classroomConnection.findUnique({
      where: { tenantId },
      include: {
        courseMappings: { orderBy: { createdAt: "desc" } },
        identityMappings: { orderBy: { createdAt: "desc" } },
        syncRuns: { orderBy: { createdAt: "desc" }, take: 25 },
      },
    });
    return value ? this.summary(value) : null;
  }

  async authorize(
    tenantId: string,
    input: AuthorizeClassroomDto,
    actorId?: string,
  ) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException(
        "Use an ARN, vault://, or secret:// credential reference; credential values are not accepted",
      );
    await this.requireTenant(tenantId);
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.classroomConnection.upsert({
        where: { tenantId },
        create: {
          tenantId,
          ...input,
          authorizedBy: actorId,
          lastValidatedAt: new Date(),
        },
        update: {
          ...input,
          authorizedBy: actorId,
          lastValidatedAt: new Date(),
          status: "AUTHORIZED",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "classroom.authorize",
          object: "ClassroomConnection",
          objectId: saved.id,
          outcome: "AUTHORIZED",
          newValue: {
            delegatedAdminEmail: input.delegatedAdminEmail,
            credentialReference: input.credentialReference,
          },
        },
      });
    });
    return this.get(tenantId);
  }

  async mapCourse(
    tenantId: string,
    input: MapClassroomCourseDto,
    actorId?: string,
  ) {
    const connection = await this.requireConnection(tenantId);
    const local = await this.prisma.classSection.findFirst({
      where: { id: input.classId, tenantId },
    });
    if (!local)
      throw new NotFoundException("Class was not found for this tenant");
    try {
      const value = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.classroomCourseMapping.upsert({
          where: { tenantId_classId: { tenantId, classId: input.classId } },
          create: { tenantId, connectionId: connection.id, ...input },
          update: { ...input, connectionId: connection.id, enabled: true },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId,
            action: "classroom.course_mapping.upsert",
            object: "ClassroomCourseMapping",
            objectId: saved.id,
            outcome: "MAPPED",
            newValue: {
              classId: input.classId,
              externalCourseId: input.externalCourseId,
              externalCourseName: input.externalCourseName,
              syncRoster: input.syncRoster,
              syncMaterials: input.syncMaterials,
            },
          },
        });
        return saved;
      });
      return value;
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException(
          "That Classroom course is already mapped in this tenant",
        );
      throw error;
    }
  }

  async mapIdentity(
    tenantId: string,
    input: MapClassroomIdentityDto,
    actorId?: string,
  ) {
    const connection = await this.requireConnection(tenantId);
    const model =
      input.localType === "STUDENT" ? this.prisma.student : this.prisma.user;
    const local = await (model as any).findFirst({
      where: {
        id: input.localId,
        tenantId,
        ...(input.localType === "TEACHER" ? { role: "TEACHER" } : {}),
      },
    });
    if (!local)
      throw new NotFoundException(
        `${input.localType.toLowerCase()} was not found for this tenant`,
      );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saved = await tx.classroomIdentityMapping.upsert({
          where: {
            tenantId_localType_localId: {
              tenantId,
              localType: input.localType,
              localId: input.localId,
            },
          },
          create: { tenantId, connectionId: connection.id, ...input },
          update: {
            externalUserId: input.externalUserId,
            externalEmail: input.externalEmail,
            connectionId: connection.id,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId,
            action: "classroom.identity_mapping.upsert",
            object: "ClassroomIdentityMapping",
            objectId: saved.id,
            outcome: "MAPPED",
            newValue: {
              localType: input.localType,
              localId: input.localId,
              externalUserId: input.externalUserId,
            },
          },
        });
        return saved;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException(
          "That Classroom identity is already mapped in this tenant",
        );
      throw error;
    }
  }

  async startSync(
    tenantId: string,
    input: StartClassroomSyncDto,
    actorId?: string,
  ): Promise<ClassroomSyncRunSummary> {
    if (!input.syncRoster && !input.syncMaterials)
      throw new BadRequestException("Select roster or materials to sync");
    if (!input.courseMappingIds.length)
      throw new BadRequestException("Select at least one mapped course");
    const connection = await this.requireConnection(tenantId);
    const mappings = await this.prisma.classroomCourseMapping.findMany({
      where: {
        tenantId,
        connectionId: connection.id,
        id: { in: [...new Set(input.courseMappingIds)] },
        enabled: true,
      },
    });
    if (mappings.length !== new Set(input.courseMappingIds).size)
      throw new BadRequestException(
        "Every selected course must be an enabled tenant mapping",
      );
    if (input.syncRoster && mappings.some((item) => !item.syncRoster))
      throw new BadRequestException(
        "Roster sync was not enabled for every selected course",
      );
    if (input.syncMaterials && mappings.some((item) => !item.syncMaterials))
      throw new BadRequestException(
        "Material sync was not enabled for every selected course",
      );
    const run = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.classroomSyncRun.create({
        data: {
          tenantId,
          connectionId: connection.id,
          requestedCourseIds: mappings.map((item) => item.id),
          syncRoster: input.syncRoster,
          syncMaterials: input.syncMaterials,
          requestedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "classroom.sync.queue",
          object: "ClassroomSyncRun",
          objectId: saved.id,
          outcome: "QUEUED",
          newValue: {
            courseMappingIds: saved.requestedCourseIds,
            syncRoster: input.syncRoster,
            syncMaterials: input.syncMaterials,
          },
        },
      });
      return saved;
    });
    return this.runSummary(run);
  }

  async retry(tenantId: string, runId: string, actorId?: string) {
    const prior = await this.prisma.classroomSyncRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!prior)
      throw new NotFoundException("Sync run was not found for this tenant");
    if (prior.status !== "FAILED")
      throw new BadRequestException("Only failed sync runs can be retried");
    const run = await this.prisma.classroomSyncRun.create({
      data: {
        tenantId,
        connectionId: prior.connectionId,
        requestedCourseIds: prior.requestedCourseIds,
        syncRoster: prior.syncRoster,
        syncMaterials: prior.syncMaterials,
        attempt: prior.attempt + 1,
        retryOfId: prior.id,
        requestedBy: actorId,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorId,
        action: "classroom.sync.retry",
        object: "ClassroomSyncRun",
        objectId: run.id,
        outcome: "QUEUED",
        newValue: { retryOfId: prior.id, attempt: run.attempt },
      },
    });
    return this.runSummary(run);
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException("Tenant was not found");
    return tenant;
  }
  private async requireConnection(tenantId: string) {
    const value = await this.prisma.classroomConnection.findUnique({
      where: { tenantId },
    });
    if (!value || value.status !== "AUTHORIZED")
      throw new BadRequestException(
        "Authorize Google Classroom for this tenant first",
      );
    return value;
  }
  private runSummary(value: any): ClassroomSyncRunSummary {
    return {
      id: value.id,
      requestedCourseIds: value.requestedCourseIds,
      syncRoster: value.syncRoster,
      syncMaterials: value.syncMaterials,
      status: value.status,
      attempt: value.attempt,
      retryOfId: value.retryOfId ?? null,
      outcome: value.outcome ?? null,
      errorCode: value.errorCode ?? null,
      errorMessage: value.errorMessage ?? null,
      createdAt: value.createdAt.toISOString(),
      completedAt: value.completedAt?.toISOString() ?? null,
    };
  }
  private summary(value: any): ClassroomConnectionSummary {
    return {
      id: value.id,
      status: value.status,
      delegatedAdminEmail: value.delegatedAdminEmail,
      credentialReference: value.credentialReference,
      lastValidatedAt: value.lastValidatedAt?.toISOString() ?? null,
      courseMappings: value.courseMappings.map((item: any) => ({
        id: item.id,
        classId: item.classId,
        externalCourseId: item.externalCourseId,
        externalCourseName: item.externalCourseName,
        syncRoster: item.syncRoster,
        syncMaterials: item.syncMaterials,
        enabled: item.enabled,
      })),
      identityMappings: value.identityMappings.map((item: any) => ({
        id: item.id,
        localType: item.localType,
        localId: item.localId,
        externalUserId: item.externalUserId,
        externalEmail: item.externalEmail,
      })),
      syncRuns: value.syncRuns.map((item: any) => this.runSummary(item)),
    };
  }
}
