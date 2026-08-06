import { afterEach, describe, expect, it } from "vitest";
import { WorkerMdmConnector } from "./worker-mdm.connector";

describe("WorkerMdmConnector", () => {
  afterEach(() => {
    delete process.env.MDM_CONNECTOR_MODE;
  });

  it("uses the safe stub connector unless production mode is configured", async () => {
    const connector = new WorkerMdmConnector();

    await expect(
      connector.dispatchCommand(
        {
          expiresAt: null,
          id: "command-1",
          payload: {},
          reason: null,
          type: "LOCK",
        } as never,
        { connectorDeviceName: null, enrollmentId: null },
      ),
    ).resolves.toEqual({
      accepted: true,
      connector: "STUB",
      connectorCommandId: "stub:command-1",
      response: { mode: "worker" },
    });
  });

  it("fails safely before authentication when production identity is missing", async () => {
    process.env.MDM_CONNECTOR_MODE = "android-management";
    const connector = new WorkerMdmConnector();

    await expect(
      connector.dispatchCommand(
        {
          expiresAt: null,
          id: "command-1",
          payload: {},
          reason: null,
          type: "LOCK",
        } as never,
        { connectorDeviceName: null, enrollmentId: null },
      ),
    ).resolves.toMatchObject({
      accepted: false,
      connector: "ANDROID_MANAGEMENT_API",
      retryable: false,
    });
  });
});
