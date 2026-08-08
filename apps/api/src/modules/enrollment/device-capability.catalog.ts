import type {
  DeviceComplianceAssessment,
  DeviceCapability,
  DeviceEnrollmentType,
  DeviceOwnership,
  PlatformCapabilityCatalog,
} from "@virtual-school/shared";

const androidLifecycle = { minimum: "12", recommended: "14" };

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

export function assessAndroidCompliance(input: {
  compliance: string; health: string; osVersion?: string | null; status: string;
}): DeviceComplianceAssessment {
  let score = 100;
  const reasons: string[] = [];
  const restrictions: string[] = [];
  const major = Number.parseInt(input.osVersion?.match(/\d+/)?.[0] ?? "", 10);
  let osLifecycle: DeviceComplianceAssessment["osLifecycle"] = "UNKNOWN";
  let updateRecommendation = "Report the OS version to evaluate lifecycle support.";
  if (Number.isFinite(major)) {
    if (major < Number(androidLifecycle.minimum)) {
      osLifecycle = "UNSUPPORTED"; score -= 40;
      reasons.push(`OS ${input.osVersion} is below supported Android ${androidLifecycle.minimum}.`);
      restrictions.push("Block new policy publication and sensitive remote operations until the OS is updated.");
      updateRecommendation = `Update to Android ${androidLifecycle.recommended} or later before continued managed use.`;
    } else if (major < Number(androidLifecycle.recommended)) {
      osLifecycle = "UPDATE_RECOMMENDED"; score -= 10;
      reasons.push(`OS ${input.osVersion} remains supported but is below recommended Android ${androidLifecycle.recommended}.`);
      updateRecommendation = `Schedule an update to Android ${androidLifecycle.recommended} or later.`;
    } else {
      osLifecycle = "SUPPORTED";
      updateRecommendation = "No OS lifecycle update is currently required.";
    }
  } else { score -= 10; reasons.push("OS lifecycle cannot be verified because the version is unknown."); }
  if (!["COMPLIANT", "UNKNOWN"].includes(input.compliance)) {
    score -= 30; reasons.push(`Provider compliance state is ${input.compliance}.`);
  } else if (input.compliance === "UNKNOWN") {
    score -= 10; reasons.push("Provider compliance state has not been reported.");
  }
  if (!["HEALTHY", "CHECKED_IN"].includes(input.health)) {
    score -= 15; reasons.push(`Device health is ${input.health}.`);
  }
  if (["OFFLINE", "ENROLLMENT_FAILED", "LOST"].includes(input.status)) {
    score -= 15; reasons.push(`Device status is ${input.status}.`);
  }
  score = Math.max(0, score);
  return {
    capabilityNote: "Score uses observable Android controls; unsupported physical recovery reset prevention is excluded.",
    grade: score >= 80 ? "GOOD" : score >= 50 ? "ATTENTION" : "CRITICAL",
    minimumSupportedVersion: androidLifecycle.minimum, osLifecycle,
    reasons: reasons.length ? reasons : ["All observable compliance signals meet the current baseline."],
    recommendedVersion: androidLifecycle.recommended, restrictions, score, updateRecommendation,
  };
}
