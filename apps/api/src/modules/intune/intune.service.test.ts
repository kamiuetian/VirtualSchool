import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { IntuneService } from "./intune.service";

describe("IntuneService", () => {
  it("rejects embedded Microsoft credentials", async () => {
    const service = new IntuneService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.authorize("tenant-1", {
        entraTenantId: "11111111-1111-4111-8111-111111111111",
        clientId: "22222222-2222-4222-8222-222222222222",
        credentialReference: "client-secret",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires every device to use a tenant-mapped group", async () => {
    const service = new IntuneService({
      intuneConnection: {
        findUnique: async () => ({ id: "connection-1", status: "AUTHORIZED" }),
      },
      intuneGroupMapping: { findMany: async () => [] },
    } as never);
    await expect(
      service.ingestInventory("tenant-1", {
        devices: [
          {
            externalDeviceId: "win-1",
            groupId: "foreign",
            serialNumber: "S1",
            kioskStatus: "SUPPORTED",
            assessmentStatus: "SUPPORTED",
            autopilotStatus: "SUPPORTED",
            appDeploymentStatus: "SUPPORTED",
            managementHealthStatus: "SUPPORTED",
          },
        ],
      }),
    ).rejects.toThrow("enabled tenant group mapping");
  });

  it("ingests explicit Windows capability and health states", async () => {
    const calls: Array<{ name: string; value?: any }> = [];
    const tx = {
      device: {
        upsert: async (args: any) => {
          calls.push({ name: "device", value: args });
          return { id: "device-1" };
        },
      },
      intuneDeviceState: {
        upsert: async (args: any) => calls.push({ name: "state", value: args }),
      },
      intuneConnection: {
        update: async () => calls.push({ name: "connection" }),
      },
      auditEvent: {
        create: async (args: any) => calls.push({ name: "audit", value: args }),
      },
    };
    const service = new IntuneService({
      intuneConnection: {
        findUnique: async () => ({ id: "connection-1", status: "AUTHORIZED" }),
      },
      intuneGroupMapping: {
        findMany: async () => [{ groupId: "group-1", branchId: null }],
      },
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
    } as never);
    service.get = async () => null;
    await service.ingestInventory(
      "tenant-1",
      {
        devices: [
          {
            externalDeviceId: "win-1",
            groupId: "group-1",
            serialNumber: "S1",
            osVersion: "11",
            kioskStatus: "SUPPORTED",
            assessmentStatus: "PARTIAL",
            autopilotStatus: "SUPPORTED",
            appDeploymentStatus: "SUPPORTED",
            managementHealthStatus: "SUPPORTED",
          },
        ],
      },
      "admin-1",
    );
    expect(calls[0]!.value.create).toMatchObject({
      tenantId: "tenant-1",
      manufacturer: "Microsoft",
      mdmConnector: "MICROSOFT_INTUNE",
    });
    expect(calls[1]!.value.create).toMatchObject({
      assessmentStatus: "PARTIAL",
      autopilotStatus: "SUPPORTED",
    });
    expect(calls[3]!.value.data).toMatchObject({
      action: "intune.inventory.ingest",
      outcome: "SYNCED",
    });
  });
});
