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
    blockSafeMode: true,
    blockSettings: true,
  },
  urlAllowlist: ["https://school.example"],
  urlBlocklist: [],
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
      kioskCustomLauncherEnabled: true,
      name: "enterprises/enterprise-1/policies/vs-tenant-1-policy-1",
      safeBootDisabled: true,
    });
  });
});
