import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AppleMdmService } from "./apple-mdm.service";

describe("AppleMdmService", () => {
  it("rejects embedded token or certificate values", async () => {
    const service = new AppleMdmService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.configure("tenant-1", {
        providerName: "Vendor",
        serverUrl: "https://mdm.test",
        credentialReference: "raw-token",
        appleSchoolManagerId: "ASM-1",
        tokenExpiresAt: "2099-01-01T00:00:00.000Z",
        certificateExpiresAt: "2099-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects expired setup material", async () => {
    const service = new AppleMdmService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.configure("tenant-1", {
        providerName: "Vendor",
        serverUrl: "https://mdm.test",
        credentialReference: "secret://apple",
        appleSchoolManagerId: "ASM-1",
        tokenExpiresAt: "2020-01-01T00:00:00.000Z",
        certificateExpiresAt: "2099-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("must not be expired");
  });

  it("ingests explicit ADE, supervision, restriction, app and configuration states", async () => {
    const calls: Array<{ name: string; value?: any }> = [];
    const tx = {
      device: {
        upsert: async (args: any) => {
          calls.push({ name: "device", value: args });
          return { id: "device-1" };
        },
      },
      appleDeviceState: {
        upsert: async (args: any) => calls.push({ name: "state", value: args }),
      },
      appleMdmConnection: {
        update: async () => calls.push({ name: "connection" }),
      },
      auditEvent: {
        create: async (args: any) => calls.push({ name: "audit", value: args }),
      },
    };
    const service = new AppleMdmService({
      appleMdmConnection: {
        findUnique: async () => ({ id: "connection-1", status: "AUTHORIZED" }),
      },
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
    } as never);
    service.get = async () => null;
    await service.ingestInventory(
      "tenant-1",
      {
        devices: [
          {
            externalDeviceId: "ipad-1",
            serialNumber: "SERIAL-1",
            osVersion: "18.1",
            adeStatus: "SUPPORTED",
            supervisionStatus: "SUPPORTED",
            restrictionStatus: "PARTIAL",
            appBookStatus: "SUPPORTED",
            managedConfigurationStatus: "SUPPORTED",
          },
        ],
      },
      "admin-1",
    );
    expect(calls[0]!.value.create).toMatchObject({
      tenantId: "tenant-1",
      manufacturer: "Apple",
      mdmConnector: "APPLE_EXTERNAL_MDM",
    });
    expect(calls[1]!.value.create).toMatchObject({
      tenantId: "tenant-1",
      supervisionStatus: "SUPPORTED",
      restrictionStatus: "PARTIAL",
    });
    expect(calls[3]!.value.data).toMatchObject({
      action: "apple_mdm.inventory.ingest",
      outcome: "SYNCED",
    });
  });
});
