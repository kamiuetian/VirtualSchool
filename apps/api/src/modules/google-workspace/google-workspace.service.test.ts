import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { GoogleWorkspaceService } from "./google-workspace.service";

describe("GoogleWorkspaceService", () => {
  it("rejects raw credentials", async () => {
    const service = new GoogleWorkspaceService({ tenant: { findUnique: async () => ({ id: "tenant-1" }) } } as never);
    await expect(service.authorize("tenant-1", {
      customerId: "C01", delegatedAdminEmail: "admin@school.test", credentialReference: "private-key-value",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects inventory from an unmapped organizational unit", async () => {
    const service = new GoogleWorkspaceService({
      googleWorkspaceConnection: { findUnique: async () => ({ id: "connection-1", tenantId: "tenant-1", status: "AUTHORIZED" }) },
      googleWorkspaceOuMapping: { findMany: async () => [] },
    } as never);
    await expect(service.ingestInventory("tenant-1", { devices: [{
      externalDeviceId: "chrome-1", organizationalUnitId: "ou-other", serialNumber: "SERIAL-1",
      kioskStatus: "SUPPORTED", managedSessionStatus: "SUPPORTED", appExtensionStatus: "PARTIAL", webPolicyStatus: "SUPPORTED",
    }] })).rejects.toThrow("enabled tenant organizational-unit mapping");
  });

  it("upserts tenant inventory and records explicit capability status", async () => {
    const calls: Array<{ name: string; value?: any }> = [];
    const tx = {
      device: { upsert: async (args: any) => { calls.push({ name: "device", value: args }); return { id: "device-1" }; } },
      chromeOsDeviceState: { upsert: async (args: any) => calls.push({ name: "state", value: args }) },
      googleWorkspaceConnection: { update: async () => calls.push({ name: "connection" }) },
      auditEvent: { create: async (args: any) => calls.push({ name: "audit", value: args }) },
    };
    const service = new GoogleWorkspaceService({
      googleWorkspaceConnection: { findUnique: async () => ({ id: "connection-1", tenantId: "tenant-1", status: "AUTHORIZED" }) },
      googleWorkspaceOuMapping: { findMany: async () => [{ organizationalUnitId: "ou-1", branchId: "branch-1" }] },
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
    } as never);
    service.get = async () => null;
    await service.ingestInventory("tenant-1", { devices: [{
      externalDeviceId: "chrome-1", organizationalUnitId: "ou-1", serialNumber: "SERIAL-1", osVersion: "126",
      kioskStatus: "SUPPORTED", managedSessionStatus: "PARTIAL", appExtensionStatus: "SUPPORTED", webPolicyStatus: "UNSUPPORTED",
    }] }, "admin-1");
    expect(calls.map((item) => item.name)).toEqual(["device", "state", "connection", "audit"]);
    expect(calls[0]!.value.create).toMatchObject({ tenantId: "tenant-1", branchId: "branch-1", mdmConnector: "GOOGLE_CHROME_ENTERPRISE" });
    expect(calls[1]!.value.create).toMatchObject({ tenantId: "tenant-1", webPolicyStatus: "UNSUPPORTED" });
    expect(calls[3]!.value.data).toMatchObject({ action: "google_workspace.inventory.ingest", outcome: "SYNCED" });
  });
});
