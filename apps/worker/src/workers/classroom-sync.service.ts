import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../api/src/generated/prisma";
import { WorkerPrismaService } from "../prisma/worker-prisma.service";

type ProviderResult = { rosterImported?: number; materialsImported?: number };
@Injectable()
export class ClassroomSyncService {
  constructor(
    @Inject(WorkerPrismaService) private readonly prisma: WorkerPrismaService,
  ) {}

  async processTenant(tenantId: string): Promise<Record<string, unknown>> {
    const runs = await this.prisma.classroomSyncRun.findMany({
      orderBy: { createdAt: "asc" },
      take: 10,
      where: { tenantId, status: "QUEUED" },
      include: { connection: true },
    });
    let succeeded = 0;
    let failed = 0;
    for (const run of runs) {
      await this.prisma.classroomSyncRun.update({
        where: { id: run.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      try {
        const mappings = await this.prisma.classroomCourseMapping.findMany({
          where: {
            tenantId,
            connectionId: run.connectionId,
            id: { in: run.requestedCourseIds },
            enabled: true,
          },
        });
        if (mappings.length !== run.requestedCourseIds.length)
          throw new Error("MAPPING_SELECTION_CHANGED");
        const identities = await this.prisma.classroomIdentityMapping.findMany({
          where: { tenantId, connectionId: run.connectionId },
        });
        const outcome = await this.dispatch({
          tenantId,
          credentialReference: run.connection.credentialReference,
          delegatedAdminEmail: run.connection.delegatedAdminEmail,
          syncRoster: run.syncRoster,
          syncMaterials: run.syncMaterials,
          courses: mappings.map((item) => ({
            localClassId: item.classId,
            externalCourseId: item.externalCourseId,
          })),
          identities: identities.map((item) => ({
            localType: item.localType,
            localId: item.localId,
            externalUserId: item.externalUserId,
          })),
        });
        await this.finish(run.id, tenantId, "SUCCEEDED", outcome);
        succeeded += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Classroom provider failed";
        await this.finish(
          run.id,
          tenantId,
          "FAILED",
          undefined,
          message === "MAPPING_SELECTION_CHANGED"
            ? "MAPPING_SELECTION_CHANGED"
            : "PROVIDER_UNAVAILABLE",
          message,
        );
        failed += 1;
      }
    }
    return {
      job: "classroom.sync",
      tenantId,
      evaluated: runs.length,
      succeeded,
      failed,
    };
  }

  private async dispatch(
    payload: Record<string, unknown>,
  ): Promise<ProviderResult> {
    const url = process.env.CLASSROOM_SYNC_PROVIDER_URL;
    if (!url) throw new Error("CLASSROOM_SYNC_PROVIDER_URL is not configured");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLASSROOM_SYNC_PROVIDER_TOKEN
          ? {
              Authorization: `Bearer ${process.env.CLASSROOM_SYNC_PROVIDER_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(`Classroom provider returned ${response.status}`);
    return (await response.json()) as ProviderResult;
  }

  private async finish(
    id: string,
    tenantId: string,
    status: "SUCCEEDED" | "FAILED",
    outcome?: ProviderResult,
    errorCode?: string,
    errorMessage?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.classroomSyncRun.update({
        where: { id },
        data: {
          status,
          completedAt: new Date(),
          outcome: outcome as Prisma.InputJsonValue | undefined,
          errorCode,
          errorMessage,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: "worker",
          action: "classroom.sync.complete",
          object: "ClassroomSyncRun",
          objectId: id,
          outcome: status,
          newValue: {
            status,
            ...(outcome ?? {}),
            errorCode: errorCode ?? null,
          },
        },
      });
    });
  }
}
