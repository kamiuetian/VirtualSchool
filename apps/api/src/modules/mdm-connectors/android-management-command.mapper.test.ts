import { describe, expect, it } from "vitest";
import { AndroidManagementCommandMapper } from "./android-management-command.mapper";

describe("AndroidManagementCommandMapper", () => {
  it("maps lock commands to Android Management API LOCK", () => {
    const mapper = new AndroidManagementCommandMapper();

    expect(
      mapper.map({
        ttlSeconds: 300,
        type: "LOCK",
      }),
    ).toEqual({
      command: {
        duration: "300s",
        type: "LOCK",
      },
      supported: true,
    });
  });

  it("maps wipe commands with reset protection preservation", () => {
    const mapper = new AndroidManagementCommandMapper();

    expect(
      mapper.map({
        payload: {
          preserveFactoryResetProtection: true,
        },
        reason: "Lost device",
        ttlSeconds: 60,
        type: "WIPE",
      }),
    ).toMatchObject({
      command: {
        type: "WIPE",
        wipeParams: {
          wipeDataFlags: ["PRESERVE_RESET_PROTECTION_DATA"],
          wipeReason: {
            defaultMessage: "Lost device",
          },
        },
      },
      supported: true,
    });
  });

  it("rejects commands that are not direct Android Management commands", () => {
    const mapper = new AndroidManagementCommandMapper();

    expect(
      mapper.map({
        type: "APP_INSTALL",
      }),
    ).toMatchObject({
      supported: false,
    });
  });
});
