import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  SisOperationsSummary,
  SisRecordOutcome,
  SisSyncRunSummary,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ReconcileSisDto,
  SisReconciliationRecordDto,
} from "./dto/sis.dto";

@Injectable()
export class SisService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async operations(tenantId: string): Promise<SisOperationsSummary> {
    await this.requireTenant(tenantId);
    const runs = await this.prisma.sisSyncRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const success = runs.find((run) => run.status === "SUCCEEDED");
    return {
      lastSuccessAt: success?.completedAt?.toISOString() ?? null,
      runs: runs.map((run) => this.summary(run)),
    };
  }

  async reconcile(
    tenantId: string,
    input: ReconcileSisDto,
    actorId?: string,
    retryOfId?: string,
    attempt = 1,
  ) {
    await this.requireTenant(tenantId);
    const source = input.source.trim().toUpperCase();
    const records: SisRecordOutcome[] = [];
    for (const record of input.records) {
      const error = await this.validateLocal(tenantId, record);
      if (error) {
        records.push({ ...record, status: "FAILED", error });
        continue;
      }
      try {
        await this.prisma.sisMapping.upsert({
          where: {
            tenantId_objectType_localId_source: {
              tenantId,
              objectType: record.objectType,
              localId: record.localId,
              source,
            },
          },
          create: { tenantId, source, ...record },
          update: { externalId: record.externalId },
        });
        records.push({ ...record, status: "RECONCILED" });
      } catch (error) {
        const conflict = (error as { code?: string }).code === "P2002";
        records.push({
          ...record,
          status: "FAILED",
          error: conflict
            ? "External ID is already mapped for this object type"
            : "Mapping could not be saved",
        });
      }
    }
    const failedRecords = records.filter(
      (record) => record.status === "FAILED",
    ).length;
    const status =
      failedRecords === 0
        ? "SUCCEEDED"
        : failedRecords === records.length
          ? "FAILED"
          : "PARTIAL";
    const run = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.sisSyncRun.create({
        data: {
          tenantId,
          source,
          status,
          attempt,
          retryOfId,
          requestedBy: actorId,
          totalRecords: records.length,
          affectedRecords: records.length - failedRecords,
          failedRecords,
          records: records as any,
          completedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: retryOfId
            ? "sis.reconciliation.retry"
            : "sis.reconciliation.run",
          object: "SisSyncRun",
          objectId: saved.id,
          outcome: status,
          newValue: {
            source,
            totalRecords: records.length,
            affectedRecords: records.length - failedRecords,
            failedRecords,
            retryOfId,
          },
        },
      });
      return saved;
    });
    return this.summary(run);
  }

  async retry(tenantId: string, runId: string, actorId?: string) {
    const run = await this.prisma.sisSyncRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run)
      throw new NotFoundException(
        "SIS reconciliation run was not found for this tenant",
      );
    const failed = (run.records as unknown as SisRecordOutcome[])
      .filter((record) => record.status === "FAILED")
      .map(({ objectType, localId, externalId }) => ({
        objectType,
        localId,
        externalId,
      }));
    if (!failed.length) return this.summary(run);
    return this.reconcile(
      tenantId,
      { source: run.source, records: failed },
      actorId,
      run.id,
      run.attempt + 1,
    );
  }

  private async validateLocal(
    tenantId: string,
    record: SisReconciliationRecordDto,
  ): Promise<string | null> {
    if (record.objectType === "ENROLLMENT") {
      const [classId, studentId, extra] = record.localId.split(":");
      if (!classId || !studentId || extra)
        return "Enrollment localId must be classId:studentId";
      const value = await this.prisma.classMembership.findFirst({
        where: {
          classId,
          studentId,
          class: { tenantId },
          student: { tenantId },
        },
      });
      return value ? null : "Enrollment was not found for this tenant";
    }
    const delegate =
      record.objectType === "STUDENT"
        ? this.prisma.student
        : record.objectType === "CLASS"
          ? this.prisma.classSection
          : record.objectType === "TEACHER"
            ? this.prisma.user
            : this.prisma.guardian;
    const value = await (delegate as any).findFirst({
      where: {
        id: record.localId,
        tenantId,
        ...(record.objectType === "TEACHER" ? { role: "TEACHER" } : {}),
      },
    });
    return value
      ? null
      : `${record.objectType.toLowerCase()} was not found for this tenant`;
  }
  private requireTenant(tenantId: string) {
    return this.prisma.tenant
      .findUnique({ where: { id: tenantId } })
      .then((value) => {
        if (!value) throw new NotFoundException("Tenant not found");
        return value;
      });
  }
  private summary(run: any): SisSyncRunSummary {
    return {
      id: run.id,
      source: run.source,
      status: run.status,
      attempt: run.attempt,
      retryOfId: run.retryOfId,
      totalRecords: run.totalRecords,
      affectedRecords: run.affectedRecords,
      failedRecords: run.failedRecords,
      records: run.records as SisRecordOutcome[],
      requestedBy: run.requestedBy,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }
}
