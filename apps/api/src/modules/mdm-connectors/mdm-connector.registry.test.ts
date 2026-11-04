import { afterEach, describe, expect, it, vi } from "vitest";
import { MdmConnectorRegistry } from "./mdm-connector.registry";

describe("MdmConnectorRegistry", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when the connector mode is missing or invalid", () => {
    delete process.env.MDM_CONNECTOR_MODE;
    const connector = { name: "android-management" } as never;
    const registry = new MdmConnectorRegistry(connector);

    expect(() => registry.getActiveConnector()).toThrow(
      "MDM_CONNECTOR_MODE must be explicitly set to android-management",
    );

    vi.stubEnv("MDM_CONNECTOR_MODE", "stub");
    expect(() => registry.getActiveConnector()).toThrow(
      "MDM_CONNECTOR_MODE must be explicitly set to android-management",
    );
  });

  it("returns the real connector only when explicitly configured", () => {
    vi.stubEnv("MDM_CONNECTOR_MODE", "android-management");
    const connector = { name: "android-management" } as never;
    const registry = new MdmConnectorRegistry(connector);

    expect(registry.getActiveConnector()).toBe(connector);
  });
});
