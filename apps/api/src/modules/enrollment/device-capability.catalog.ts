import type {
  DeviceCapability,
  DeviceEnrollmentType,
  DeviceOwnership,
  PlatformCapabilityCatalog,
} from "@virtual-school/shared";

const managed: DeviceEnrollmentType[] = ["FULLY_MANAGED"];
const school: DeviceOwnership[] = ["SCHOOL_OWNED", "CORPORATE"];

function capability(
  key: string,
  label: string,
  support: DeviceCapability["support"],
  enrollmentTypes: DeviceEnrollmentType[],
  ownershipTypes: DeviceOwnership[],
  note?: string,
  minimumOsVersion?: string,
): DeviceCapability {
  return { enrollmentTypes, key, label, minimumOsVersion, note, ownershipTypes, support };
}

export const platformCapabilityCatalog: PlatformCapabilityCatalog[] = [
  {
    platform: "ANDROID",
    provider: "android-management-api",
    capabilities: [
      capability("kiosk", "Dedicated-device kiosk", "SUPPORTED", managed, school, undefined, "9"),
      capability("web-filter", "Managed web filtering", "SUPPORTED", managed, school),
      capability("app-deployment", "Managed app deployment", "SUPPORTED", managed, school),
      capability("remote-lock", "Remote lock", "SUPPORTED", managed, school),
      capability("remote-wipe", "Remote wipe", "SUPPORTED", managed, school),
      capability("hardware-reset-block", "Block hardware recovery reset", "UNSUPPORTED", managed, school, "Physical recovery controls cannot be guaranteed by policy."),
    ],
  },
  {
    platform: "CHROMEOS",
    provider: "google-admin",
    capabilities: [
      capability("kiosk", "Kiosk and managed sessions", "PARTIAL", managed, school, "Requires a Google Workspace integration."),
      capability("web-filter", "Managed web filtering", "PARTIAL", managed, school, "Requires organizational-unit policy mapping."),
      capability("app-deployment", "Extension and app deployment", "PARTIAL", managed, school, "Requires a Google Workspace integration."),
      capability("remote-wipe", "Remote wipe", "UNSUPPORTED", managed, school, "Not available until a provider connector is enabled."),
    ],
  },
  {
    platform: "IPADOS",
    provider: "external-apple-mdm",
    capabilities: [
      capability("kiosk", "Single App Mode", "PARTIAL", ["SUPERVISED"], school, "Requires supervision and an external MDM."),
      capability("web-filter", "Managed web filtering", "PARTIAL", ["SUPERVISED"], school, "Depends on external MDM support."),
      capability("app-deployment", "Managed app and book deployment", "PARTIAL", ["SUPERVISED"], school, "Requires Apps and Books integration."),
      capability("remote-wipe", "Remote wipe", "PARTIAL", ["SUPERVISED"], school, "Requires an external MDM connector."),
    ],
  },
  ...(["IOS", "MACOS", "WINDOWS"] as const).map((platform) => ({
    platform,
    provider: platform === "WINDOWS" ? "microsoft-intune" : "external-apple-mdm",
    capabilities: [
      capability("inventory", "Unified inventory", "PARTIAL", ["FULLY_MANAGED", "SUPERVISED", "USER_ENROLLED"], ["SCHOOL_OWNED", "CORPORATE", "PERSONAL"], "Provider integration is not configured yet."),
      capability("policy-enforcement", "Policy enforcement", "UNSUPPORTED", ["FULLY_MANAGED", "SUPERVISED", "USER_ENROLLED"], ["SCHOOL_OWNED", "CORPORATE", "PERSONAL"], "No active provider connector is available."),
    ],
  })),
];

export function androidControlSummary(): { supportedControls: string[]; unsupportedControls: string[] } {
  const capabilities = platformCapabilityCatalog.find((item) => item.platform === "ANDROID")?.capabilities ?? [];
  return {
    supportedControls: capabilities.filter((item) => item.support !== "UNSUPPORTED").map((item) => item.key),
    unsupportedControls: capabilities.filter((item) => item.support === "UNSUPPORTED").map((item) => item.key),
  };
}
