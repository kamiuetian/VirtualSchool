import { Injectable } from "@nestjs/common";
import type { PolicyRuleSet } from "@virtual-school/shared";
import type { Prisma } from "../../generated/prisma";

export type AndroidManagementApplicationPolicy = {
  packageName: string;
  installType: "AVAILABLE" | "FORCE_INSTALLED" | "BLOCKED" | "KIOSK";
  autoUpdateMode?:
    | "AUTO_UPDATE_DEFAULT"
    | "AUTO_UPDATE_POSTPONED"
    | "AUTO_UPDATE_HIGH_PRIORITY";
  defaultPermissionPolicy?: "GRANT" | "PROMPT" | "DENY";
  managedConfiguration?: Record<string, unknown>;
};

export type AndroidManagementPolicyPayload = {
  name: string;
  applications: AndroidManagementApplicationPolicy[];
  kioskCustomLauncherEnabled: boolean;
  installAppsDisabled: boolean;
  safeBootDisabled: boolean;
  statusReportingSettings: {
    applicationReportsEnabled: boolean;
    deviceSettingsEnabled: boolean;
    softwareInfoEnabled: boolean;
    memoryInfoEnabled: boolean;
    networkInfoEnabled: boolean;
  };
  factoryResetDisabled?: boolean;
  debuggingFeaturesAllowed?: boolean;
  systemUpdate?:
    | { type: "AUTOMATIC" | "POSTPONE" }
    | {
        type: "WINDOWED";
        startMinutes: number;
        endMinutes: number;
      };
  kioskCustomization?: {
    systemNavigation: NonNullable<
      NonNullable<PolicyRuleSet["android"]>["kioskCustomization"]
    >["systemNavigation"];
    statusBar: NonNullable<
      NonNullable<PolicyRuleSet["android"]>["kioskCustomization"]
    >["statusBar"];
    powerButtonActions: NonNullable<
      NonNullable<PolicyRuleSet["android"]>["kioskCustomization"]
    >["powerButtonActions"];
  };
};

@Injectable()
export class AndroidManagementPolicyMapper {
  map(input: {
    enterpriseId: string;
    tenantId: string;
    policyId: string;
    version: number;
    rules: PolicyRuleSet;
    apps: Array<{
      name: string;
      packageId: string;
      installRules?: Prisma.JsonValue | null;
    }>;
  }): AndroidManagementPolicyPayload {
    const launcherPackageName =
      process.env.ANDROID_LAUNCHER_PACKAGE_NAME ?? "com.virtualschool.launcher";
    const browserPackageName =
      process.env.ANDROID_BROWSER_PACKAGE_NAME ?? "com.virtualschool.browser";
    const name = this.policyResourceName(
      input.enterpriseId,
      input.tenantId,
      input.policyId,
    );
    const applications = new Map<string, AndroidManagementApplicationPolicy>();

    applications.set(launcherPackageName, {
      defaultPermissionPolicy: "GRANT",
      installType: "FORCE_INSTALLED",
      managedConfiguration: {
        approvedAppsJson: JSON.stringify(
          input.apps
            .filter(
              (app) => this.mapInstallType(app.installRules) !== "BLOCKED",
            )
            .map((app) => ({
              name: app.name,
              packageId: app.packageId,
            })),
        ),
        mode: input.rules.mode,
        policyId: input.policyId,
        policyVersion: input.version,
        showMessages: input.rules.launcher.showMessages,
        showSupportContact: input.rules.launcher.showSupportContact,
        tenantId: input.tenantId,
        webShortcutsJson: JSON.stringify(input.rules.webShortcuts),
      },
      packageName: launcherPackageName,
    });

    applications.set(browserPackageName, {
      defaultPermissionPolicy: "GRANT",
      installType: "FORCE_INSTALLED",
      managedConfiguration: {
        defaultWebAccess: input.rules.defaultWebAccess,
        policyId: input.policyId,
        policyVersion: input.version,
        tenantId: input.tenantId,
        urlAllowlist: input.rules.urlAllowlist,
        urlBlocklist: input.rules.urlBlocklist,
      },
      packageName: browserPackageName,
    });

    for (const app of input.apps) {
      applications.set(app.packageId, {
        autoUpdateMode: this.mapAutoUpdateMode(app.installRules),
        installType: this.mapInstallType(app.installRules),
        packageName: app.packageId,
      });
    }

    return {
      applications: [...applications.values()],
      debuggingFeaturesAllowed: false,
      factoryResetDisabled: input.rules.restrictions.blockFactoryReset ?? true,
      installAppsDisabled: input.rules.restrictions.blockAppInstall,
      kioskCustomLauncherEnabled: true,
      kioskCustomization: input.rules.android?.kioskCustomization,
      name,
      safeBootDisabled: input.rules.restrictions.blockSafeMode,
      systemUpdate: input.rules.android?.systemUpdate,
      statusReportingSettings: {
        applicationReportsEnabled: true,
        deviceSettingsEnabled: true,
        memoryInfoEnabled: true,
        networkInfoEnabled: true,
        softwareInfoEnabled: true,
      },
    };
  }

  policyResourceName(
    enterpriseId: string,
    tenantId: string,
    policyId: string,
  ): string {
    return `enterprises/${enterpriseId}/policies/${this.policyResourceId(tenantId, policyId)}`;
  }

  private policyResourceId(tenantId: string, policyId: string): string {
    return `vs-${tenantId}-${policyId}`.replace(/[^A-Za-z0-9_-]/g, "-");
  }

  private mapInstallType(
    installRules: Prisma.JsonValue | undefined | null,
  ): AndroidManagementApplicationPolicy["installType"] {
    const rules = this.jsonRecord(installRules);
    const installType = rules?.installType;

    if (installType === "AVAILABLE") {
      return "AVAILABLE";
    }

    if (installType === "BLOCKED") {
      return "BLOCKED";
    }

    return "FORCE_INSTALLED";
  }

  private mapAutoUpdateMode(
    installRules: Prisma.JsonValue | undefined | null,
  ): AndroidManagementApplicationPolicy["autoUpdateMode"] | undefined {
    const rules = this.jsonRecord(installRules);

    if (rules?.autoUpdateMode === "POSTPONED") {
      return "AUTO_UPDATE_POSTPONED";
    }

    if (rules?.autoUpdateMode === "HIGH_PRIORITY") {
      return "AUTO_UPDATE_HIGH_PRIORITY";
    }

    if (rules?.autoUpdateMode === "DEFAULT") {
      return "AUTO_UPDATE_DEFAULT";
    }

    return undefined;
  }

  private jsonRecord(
    value: Prisma.JsonValue | undefined | null,
  ): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
