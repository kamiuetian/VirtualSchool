import { describe, expect, it, vi } from "vitest";
import { ReportsService } from "./reports.service";

const now = new Date("2026-05-17T10:00:00.000Z");

describe("ReportsService", () => {
  it("rolls branch metrics into tenant enterprise analytics", async () => {
    const service = new ReportsService({
      tenant: {
        findUnique: async () => ({
          id: "tenant-1",
          name: "Northview",
          branches: [{ id: "branch-1", name: "Main" }],
        }),
      },
      device: {
        findMany: async () => [
          { branchId: "branch-1", compliance: "COMPLIANT" },
          { branchId: "branch-1", compliance: "NON_COMPLIANT" },
        ],
      },
      attendanceRecord: {
        findMany: async () => [
          { classId: "class-1", status: "PRESENT" },
          { classId: "class-1", status: "ABSENT" },
        ],
      },
      teacherSession: { findMany: async () => [{ classId: "class-1" }] },
      supportTicket: {
        findMany: async () => [{ device: { branchId: "branch-1" } }],
      },
      classSection: {
        findMany: async () => [{ id: "class-1", branchId: "branch-1" }],
      },
    } as never);

    await expect(
      service.getTenantEnterpriseAnalytics("tenant-1", {
        from: "2026-05-01",
        to: "2026-05-31",
      }),
    ).resolves.toMatchObject({
      scope: "TENANT",
      metrics: {
        devices: 2,
        complianceRate: 50,
        attendanceRate: 50,
        learningSessions: 1,
        openSupportTickets: 1,
      },
      tenants: [{ children: [{ id: "branch-1", metrics: { devices: 2 } }] }],
    });
  });

  it("rejects partner analytics for actors outside the operator portfolio", async () => {
    const service = new ReportsService({
      resellerPartner: {
        findUnique: async () => ({
          id: "partner-1",
          status: "ACTIVE",
          operatorIds: ["operator-1"],
        }),
      },
    } as never);
    await expect(
      service.getPartnerEnterpriseAnalytics("partner-1", "outsider", {}),
    ).rejects.toThrow("not found");
  });

  it("logs a checksummed tenant warehouse delivery", async () => {
    const createRun = vi.fn(async ({ data }) => ({ id: "run-1", ...data }));
    const audit = vi.fn();
    const service = new ReportsService({
      analyticsExportSchedule: {
        findFirst: async () => ({
          id: "schedule-1",
          tenantId: "tenant-1",
          format: "JSON",
          cadence: "DAILY",
          destinationReference: "ref:warehouse",
          destinationType: "API_STORAGE",
        }),
      },
      tenant: {
        findUnique: async () => ({
          id: "tenant-1",
          name: "Northview",
          branches: [],
        }),
      },
      device: { findMany: async () => [] },
      attendanceRecord: { findMany: async () => [] },
      teacherSession: { findMany: async () => [] },
      supportTicket: { findMany: async () => [] },
      classSection: { findMany: async () => [] },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          analyticsExportRun: { create: createRun },
          analyticsExportSchedule: { update: vi.fn() },
          auditEvent: { create: audit },
        }),
    } as never);
    const result = await service.runTenantExport(
      "tenant-1",
      "schedule-1",
      "admin-1",
    );
    expect(result).toMatchObject({
      id: "run-1",
      status: "DELIVERED",
      destination: "ref:warehouse",
    });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(audit).toHaveBeenCalled();
  });

  it("builds tenant-scoped learning usage trends and breakdowns", async () => {
    const service = new ReportsService({
      appCatalogItem: {
        findMany: async () => [{ category: "MATH", id: "resource-1" }],
      },
      attendanceRecord: {
        findMany: async () => [
          {
            attendanceDate: "2026-05-17",
            classId: "class-1",
            status: "PRESENT",
          },
          {
            attendanceDate: "2026-05-17",
            classId: "class-1",
            status: "ABSENT",
          },
        ],
      },
      classSection: {
        findMany: async () => [
          { grade: "5", id: "class-1", name: "Grade 5 Blue" },
        ],
      },
      device: {
        findMany: async () => [
          { classId: "class-1", status: "OFFLINE", tags: ["pilot"] },
        ],
      },
      teacherSession: {
        findMany: async () => [
          {
            classId: "class-1",
            startedAt: now,
            events: [
              {
                createdAt: now,
                details: { resourceId: "resource-1" },
                type: "RESOURCE_PUSHED",
              },
            ],
          },
        ],
      },
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);

    await expect(
      service.getLearningUsageAnalytics("tenant-1", {
        from: "2026-05-17",
        to: "2026-05-17",
      }),
    ).resolves.toMatchObject({
      byCategory: [{ key: "MATH", approvedResourceLaunches: 1 }],
      byDeviceGroup: [{ key: "pilot", offlineDevices: 1 }],
      totals: {
        approvedResourceLaunches: 1,
        missedSessions: 1,
        offlineDevices: 1,
        participants: 1,
        sessions: 1,
      },
      trend: [{ date: "2026-05-17", approvedResourceLaunches: 1 }],
    });
  });

  it("rejects oversized learning usage windows", async () => {
    const service = new ReportsService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.getLearningUsageAnalytics("tenant-1", {
        from: "2024-01-01",
        to: "2026-05-17",
      }),
    ).rejects.toThrow("no longer than 366 days");
  });

  it("builds a device inventory report with status totals", async () => {
    const service = new ReportsService({
      device: {
        findMany: async () => [
          {
            androidVersion: "14",
            branchId: "branch-1",
            classId: null,
            compliance: "COMPLIANT",
            connectorDeviceName: "enterprises/example/devices/device-1",
            health: "CHECKED_IN",
            id: "device-1",
            lastCheckInAt: now,
            manufacturer: "Samsung",
            mdmConnector: "ANDROID_MANAGEMENT_API",
            model: "Tab A9",
            policyVersion: 2,
            serialNumber: "SERIAL-001",
            status: "ONLINE",
            studentId: "student-1",
            tags: ["pilot"],
          },
          {
            androidVersion: "13",
            branchId: null,
            classId: null,
            compliance: "UNKNOWN",
            connectorDeviceName: null,
            health: "UNKNOWN",
            id: "device-2",
            lastCheckInAt: null,
            manufacturer: "Lenovo",
            mdmConnector: "ANDROID_MANAGEMENT_API",
            model: "Tab M10",
            policyVersion: null,
            serialNumber: "SERIAL-002",
            status: "OFFLINE",
            studentId: null,
            tags: [],
          },
        ],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.getDeviceInventoryReport("tenant-1"),
    ).resolves.toMatchObject({
      byCompliance: {
        COMPLIANT: 1,
        UNKNOWN: 1,
      },
      totals: {
        devices: 2,
        offline: 1,
        online: 1,
      },
    });
  });

  it("audits device inventory CSV exports", async () => {
    const audit = vi.fn();
    const service = new ReportsService({
      auditEvent: {
        create: audit,
      },
      device: {
        findMany: async () => [
          {
            androidVersion: "14",
            branchId: null,
            classId: null,
            compliance: "COMPLIANT",
            connectorDeviceName: null,
            health: "CHECKED_IN",
            id: "device-1",
            lastCheckInAt: now,
            manufacturer: "Samsung",
            mdmConnector: "ANDROID_MANAGEMENT_API",
            model: "Tab A9",
            policyVersion: 2,
            serialNumber: "SERIAL-001",
            status: "ONLINE",
            studentId: null,
            tags: ["pilot"],
          },
        ],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.getDeviceInventoryCsv("tenant-1", "admin-1"),
    ).resolves.toContain('"SERIAL-001"');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "report.export",
          actorId: "admin-1",
          object: "Report",
          outcome: "SUCCESS",
        }),
      }),
    );
  });

  it("builds policy deployment totals", async () => {
    const service = new ReportsService({
      policy: {
        findMany: async () => [
          {
            assignments: [{ active: true, id: "assignment-1" }],
            id: "policy-1",
            name: "Default",
            status: "PUBLISHED",
            updatedAt: now,
            version: 2,
            versions: [{ summary: "Published" }],
          },
          {
            assignments: [],
            id: "policy-2",
            name: "Draft",
            status: "DRAFT",
            updatedAt: now,
            version: 1,
            versions: [],
          },
        ],
      },
      remoteCommand: {
        findMany: async () => [
          {
            payload: {
              policyId: "policy-1",
            },
            status: "FAILED",
          },
          {
            payload: {
              policyId: "policy-1",
            },
            status: "QUEUED",
          },
        ],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.getPolicyDeploymentReport("tenant-1"),
    ).resolves.toMatchObject({
      totals: {
        activeAssignments: 1,
        draft: 1,
        failedDeployments: 1,
        policies: 2,
        published: 1,
        queuedDeploymentCommands: 1,
      },
    });
  });

  it("links app deployment rows to published policies", async () => {
    const service = new ReportsService({
      appCatalogItem: {
        findMany: async () => [
          {
            approvalStatus: "APPROVED",
            approvedGrades: ["5"],
            category: "Math",
            id: "app-1",
            name: "Math App",
            packageId: "com.example.math",
            updatedAt: now,
          },
        ],
      },
      policy: {
        findMany: async () => [
          {
            name: "Grade 5",
            rules: {
              approvedAppPackageIds: ["com.example.math"],
            },
          },
        ],
      },
      remoteCommand: {
        findMany: async () => [
          {
            payload: {
              appId: "app-1",
              packageId: "com.example.math",
            },
            status: "DELIVERED",
          },
          {
            payload: {
              appId: "app-1",
              packageId: "com.example.math",
            },
            status: "EXPIRED",
          },
        ],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.getAppDeploymentReport("tenant-1"),
    ).resolves.toMatchObject({
      apps: [
        {
          assignedPolicyCount: 1,
          failedDeploymentCount: 1,
          packageId: "com.example.math",
          policyNames: ["Grade 5"],
          queuedCommandCount: 1,
        },
      ],
      totals: {
        assignedApps: 1,
        failedDeployments: 1,
        queuedCommands: 1,
      },
    });
  });
});
