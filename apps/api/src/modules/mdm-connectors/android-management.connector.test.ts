import { afterEach, describe, expect, it, vi } from "vitest";
import { AndroidManagementConnector } from "./android-management.connector";

function connectorWithRequest(request: ReturnType<typeof vi.fn>) {
  const connector = new AndroidManagementConnector(
    { map: vi.fn() } as never,
    { map: vi.fn() } as never,
  );
  Object.assign(connector, {
    auth: {
      getClient: async () => ({ request }),
    },
  });
  return connector;
}

describe("AndroidManagementConnector enrollment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("creates the default policy and returns Google's exact QR payload", async () => {
    vi.stubEnv("ANDROID_MANAGEMENT_ENTERPRISE_ID", "enterprise-1");
    const qrCode = JSON.stringify({
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN":
          "provider-token",
      },
    });
    const request = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({
        data: { name: "enterprises/enterprise-1/policies/default" },
      })
      .mockResolvedValueOnce({
        data: {
          expirationTimestamp: "2026-08-15T12:00:00.000Z",
          name: "enterprises/enterprise-1/enrollmentTokens/token-1",
          policyName: "enterprises/enterprise-1/policies/default",
          qrCode,
          value: "provider-token",
        },
      });
    const connector = connectorWithRequest(request);

    await expect(
      connector.createEnrollmentToken({
        batchId: "batch-1",
        maxDevices: 25,
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      qrCode,
      tokenName: "enterprises/enterprise-1/enrollmentTokens/token-1",
      tokenValue: "provider-token",
    });

    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "enterprises/enterprise-1/policies/default",
          safeBootDisabled: true,
        }),
        method: "PATCH",
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          additionalData: JSON.stringify({
            batchId: "batch-1",
            tenantId: "tenant-1",
          }),
          allowPersonalUsage: "PERSONAL_USAGE_DISALLOWED_USERLESS",
          duration: "86400s",
          oneTimeOnly: false,
          policyName: "enterprises/enterprise-1/policies/default",
        }),
        method: "POST",
        url: expect.stringContaining(
          "/v1/enterprises/enterprise-1/enrollmentTokens",
        ),
      }),
    );
  });

  it("revokes only tokens owned by the configured enterprise", async () => {
    vi.stubEnv("ANDROID_MANAGEMENT_ENTERPRISE_ID", "enterprise-1");
    const request = vi.fn().mockResolvedValue({ data: {} });
    const connector = connectorWithRequest(request);

    await expect(
      connector.deleteEnrollmentToken({
        tenantId: "tenant-1",
        tokenName: "enterprises/other/enrollmentTokens/token-1",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      retryable: false,
    });
    expect(request).not.toHaveBeenCalled();

    await expect(
      connector.deleteEnrollmentToken({
        tenantId: "tenant-1",
        tokenName: "enterprises/enterprise-1/enrollmentTokens/token-1",
      }),
    ).resolves.toMatchObject({
      accepted: true,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
