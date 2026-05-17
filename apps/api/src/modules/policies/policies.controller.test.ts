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
      createPolicy: vi.fn(),
      createStarterTemplates,
      listPolicies: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy: vi.fn(),
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
      createPolicy: vi.fn(),
      createStarterTemplates: vi.fn(),
      listPolicies: vi.fn(),
      listPolicyVersions: vi.fn(),
      publishPolicy,
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
});
