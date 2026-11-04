import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateDevelopmentCredentials } from "./development-identity";

const tenant = {
  country: "PK",
  id: "tenant-beaconhouse",
  name: "Beaconhouse School System",
  planKey: "enterprise",
  status: "ACTIVE",
  timezone: "Asia/Karachi",
};

const schoolAdmin = {
  createdAt: "2026-08-14T00:00:00.000Z",
  email: "school.admin.beaconhouse@example.edu",
  id: "user-school-admin",
  mfaEnabled: false,
  mfaRequired: true,
  name: "Ayesha Siddiqui",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tenantId: tenant.id,
  updatedAt: "2026-08-14T00:00:00.000Z",
};

describe("development identity lookup", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADMIN_LOCAL_TEST_AUTH", "true");
    vi.stubEnv("ADMIN_LOCAL_TEST_PASSWORD", "local-password");
    vi.stubEnv("ADMIN_API_BASE_URL", "http://127.0.0.1:4100/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves a stored staff identity and tenant from its email", async () => {
    mockIdentityApi([schoolAdmin]);

    await expect(
      authenticateDevelopmentCredentials(
        " SCHOOL.ADMIN.BEACONHOUSE@example.edu ",
        "local-password",
      ),
    ).resolves.toEqual({
      email: "school.admin.beaconhouse@example.edu",
      name: "Ayesha Siddiqui",
      role: "SCHOOL_ADMIN",
      tenantIds: ["tenant-beaconhouse"],
    });
  });

  it("resolves the configured platform account without a tenant lookup", async () => {
    vi.stubEnv("ADMIN_API_EMAIL", "platform@example.edu");
    vi.stubEnv("ADMIN_API_NAME", "Platform Operator");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      authenticateDevelopmentCredentials(
        "platform@example.edu",
        "local-password",
      ),
    ).resolves.toEqual({
      email: "platform@example.edu",
      name: "Platform Operator",
      role: "PLATFORM_SUPER_ADMIN",
      tenantIds: ["*"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password before querying staff data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      authenticateDevelopmentCredentials(schoolAdmin.email, "wrong-password"),
    ).rejects.toThrow("Invalid email or password");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects suspended staff accounts", async () => {
    mockIdentityApi([{ ...schoolAdmin, status: "SUSPENDED" }]);

    await expect(
      authenticateDevelopmentCredentials(schoolAdmin.email, "local-password"),
    ).rejects.toThrow("Invalid email or password");
  });
});

function mockIdentityApi(users: unknown[]): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    return new Response(
      JSON.stringify(url.endsWith("/users") ? users : [tenant]),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  });
}
