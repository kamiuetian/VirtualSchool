import { describe, expect, it } from "vitest";
import { AndroidManagementPolicyMapper } from "./android-management-policy.mapper";

const rules = {
  approvedAppPackageIds: ["com.google.android.apps.classroom"],
  defaultWebAccess: "DENY" as const,
  launcher: {
    showMessages: true,
    showSupportContact: true,
  },
  mode: "TIMETABLE_CLASS" as const,
  restrictions: {
    blockAppInstall: true,
    blockFactoryReset: false,
    blockSafeMode: true,
    blockSettings: true,
  },
  android: {
    kioskCustomization: {
      powerButtonActions: "POWER_BUTTON_BLOCKED" as const,
      statusBar: "SYSTEM_INFO_ONLY" as const,
      systemNavigation: "HOME_BUTTON_ONLY" as const,
    },
    systemUpdate: {
      endMinutes: 300,
      startMinutes: 60,
      type: "WINDOWED" as const,
    },
  },
  urlAllowlist: ["https://school.example"],
  urlBlocklist: [],
  webFilter: {
    blockedCategories: ["MALWARE" as const],
    neverAllowedUrls: ["https://unsafe.example/*"],
    provider: "MANAGED_BROWSER" as const,
    safeSearch: {
      bing: true,
      google: true,
      youtubeRestrictedMode: "STRICT" as const,
    },
  },
  webShortcuts: [],
};

describe("AndroidManagementPolicyMapper", () => {
  it("maps Phase 1 policy rules into an Android Management policy payload", () => {
    const mapper = new AndroidManagementPolicyMapper();

    expect(
      mapper.map({
        apps: [
          {
            installRules: {
              autoUpdateMode: "HIGH_PRIORITY",
              installType: "FORCE_INSTALLED",
            },
            name: "Google Classroom",
            packageId: "com.google.android.apps.classroom",
          },
        ],
        enterpriseId: "enterprise-1",
        language: "ur",
        policyId: "policy-1",
        rules,
        tenantId: "tenant-1",
        version: 3,
      }),
    ).toMatchObject({
      applications: expect.arrayContaining([
        expect.objectContaining({
          installType: "FORCE_INSTALLED",
          managedConfiguration: expect.objectContaining({
            approvedAppsJson: JSON.stringify([
              {
                name: "Google Classroom",
                packageId: "com.google.android.apps.classroom",
              },
            ]),
            language: "ur",
            mode: "TIMETABLE_CLASS",
            policyVersion: 3,
            showMessages: true,
            showSupportContact: true,
            webShortcutsJson: "[]",
          }),
          packageName: "com.virtualschool.launcher",
        }),
        expect.objectContaining({
          installType: "FORCE_INSTALLED",
          managedConfiguration: expect.objectContaining({
            defaultWebAccess: "DENY",
            blockedCategories: ["MALWARE"],
            neverAllowedUrls: ["https://unsafe.example/*"],
            safeSearch: {
              bing: true,
              google: true,
              youtubeRestrictedMode: "STRICT",
            },
            urlAllowlist: ["https://school.example"],
          }),
          packageName: "com.virtualschool.browser",
        }),
        expect.objectContaining({
          autoUpdateMode: "AUTO_UPDATE_HIGH_PRIORITY",
          installType: "FORCE_INSTALLED",
          packageName: "com.google.android.apps.classroom",
        }),
      ]),
      installAppsDisabled: true,
      factoryResetDisabled: false,
      kioskCustomization: {
        powerButtonActions: "POWER_BUTTON_BLOCKED",
        statusBar: "SYSTEM_INFO_ONLY",
        systemNavigation: "HOME_BUTTON_ONLY",
      },
      kioskCustomLauncherEnabled: true,
      name: "enterprises/enterprise-1/policies/vs-tenant-1-policy-1",
      safeBootDisabled: true,
      systemUpdate: {
        endMinutes: 300,
        startMinutes: 60,
        type: "WINDOWED",
      },
    });
  });

  it("keeps safe reset defaults for policies created before Android controls", () => {
    const mapper = new AndroidManagementPolicyMapper();
    const payload = mapper.map({
      apps: [],
      enterpriseId: "enterprise-1",
      policyId: "legacy-policy",
      rules: {
        ...rules,
        android: undefined,
        restrictions: { ...rules.restrictions, blockFactoryReset: undefined },
      },
      tenantId: "tenant-1",
      version: 1,
    });

    expect(payload.factoryResetDisabled).toBe(true);
    expect(payload.systemUpdate).toBeUndefined();
    expect(payload.kioskCustomization).toBeUndefined();
  });
});
