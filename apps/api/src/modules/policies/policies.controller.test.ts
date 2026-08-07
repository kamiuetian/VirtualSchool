import { describe, expect, it, vi } from "vitest";
import { PoliciesController } from "./policies.controller";

describe("PoliciesController", () => {
  it("delegates starter template creation to the service", async () => {
    const createStarterTemplates = vi.fn().mockResolvedValue([
      {
        id: "policy-1",
        name: "Default School Mode",
        tenantId: "tenant-1",
      },
    ]);
    const controller = new PoliciesController({
      assignPolicy: vi.fn(),
      createPolicy: vi.fn(),
      createStarterTemplates,
      getDevicePolicyPayload: vi.fn(),
      listPolicies: vi.fn(),
      listPolicyAssignments: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy: vi.fn(),
      rollbackPolicy: vi.fn(),
      issueSupportUnlock: vi.fn(),
      resolveActivePolicyForDevice: vi.fn(),
    } as never);

    await expect(
      controller.createStarterTemplates("tenant-1"),
    ).resolves.toHaveLength(1);
    expect(createStarterTemplates).toHaveBeenCalledOnce();
  });

  it("delegates policy publishing to the service", async () => {
    const publishPolicy = vi.fn().mockResolvedValue({
      id: "policy-1",
      status: "PUBLISHED",
      version: 2,
    });
    const controller = new PoliciesController({
      assignPolicy: vi.fn(),
      createPolicy: vi.fn(),
      createStarterTemplates: vi.fn(),
      getDevicePolicyPayload: vi.fn(),
      listPolicies: vi.fn(),
      listPolicyAssignments: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy,
      rollbackPolicy: vi.fn(),
      issueSupportUnlock: vi.fn(),
      resolveActivePolicyForDevice: vi.fn(),
    } as never);

    await expect(
      controller.publishPolicy("tenant-1", "policy-1", {
        reason: "Ready",
      }),
    ).resolves.toMatchObject({
      status: "PUBLISHED",
      version: 2,
    });
    expect(publishPolicy).toHaveBeenCalledOnce();
  });

  it("delegates device policy payload lookup to the service", async () => {
    const getDevicePolicyPayload = vi.fn().mockResolvedValue({
      deviceId: "device-1",
      policy: {
        id: "policy-1",
      },
    });
    const controller = new PoliciesController({
      assignPolicy: vi.fn(),
      createPolicy: vi.fn(),
      createStarterTemplates: vi.fn(),
      getDevicePolicyPayload,
      listPolicies: vi.fn(),
      listPolicyAssignments: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy: vi.fn(),
      rollbackPolicy: vi.fn(),
      issueSupportUnlock: vi.fn(),
      resolveActivePolicyForDevice: vi.fn(),
    } as never);

    await expect(
      controller.getDevicePolicyPayload("tenant-1", "device-1"),
    ).resolves.toMatchObject({
      deviceId: "device-1",
    });
    expect(getDevicePolicyPayload).toHaveBeenCalledOnce();
  });

  it("delegates rollback and support unlock operations", async () => {
    const rollbackPolicy = vi.fn().mockResolvedValue({ version: 5 });
    const issueSupportUnlock = vi.fn().mockResolvedValue({ id: "unlock-1" });
    const controller = new PoliciesController({
      assignPolicy: vi.fn(),
      createPolicy: vi.fn(),
      createStarterTemplates: vi.fn(),
      getDevicePolicyPayload: vi.fn(),
      issueSupportUnlock,
      listPolicies: vi.fn(),
      listPolicyAssignments: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy: vi.fn(),
      resolveActivePolicyForDevice: vi.fn(),
      rollbackPolicy,
    } as never);

    await controller.rollbackPolicy("tenant-1", "policy-1", {
      reason: "Restore stable rules",
      version: 2,
    });
    await controller.issueSupportUnlock("tenant-1", {
      deviceId: "device-1",
      durationMinutes: 30,
      policyId: "support-policy",
      reason: "Case VS-42",
    });

    expect(rollbackPolicy).toHaveBeenCalledWith("tenant-1", "policy-1", {
      reason: "Restore stable rules",
      version: 2,
    });
    expect(issueSupportUnlock).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ deviceId: "device-1" }),
    );
  });
});
