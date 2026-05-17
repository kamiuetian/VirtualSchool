import type { StarterPolicyTemplate } from "@virtual-school/shared";

export const starterPolicyTemplates: StarterPolicyTemplate[] = [
  {
    key: "GRADE_1_3_LOCKDOWN",
    name: "Grade 1-3 Lockdown",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: true,
        showSupportContact: true,
      },
      mode: "DEFAULT_SCHOOL",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "GRADE_4_8_SUPERVISED",
    name: "Grade 4-8 Supervised Learning",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: true,
        showSupportContact: true,
      },
      mode: "TIMETABLE_CLASS",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "HOMEWORK_MODE",
    name: "Homework Mode",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: true,
        showSupportContact: true,
      },
      mode: "HOMEWORK_AFTER_SCHOOL",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "EXAM_STARTER",
    name: "Exam Starter Mode",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: false,
        showSupportContact: true,
      },
      mode: "EXAM",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "LOST_DEVICE",
    name: "Lost Device Mode",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: true,
        showSupportContact: true,
      },
      mode: "LOST_DEVICE",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "MAINTENANCE",
    name: "Maintenance Mode",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "ALLOW",
      launcher: {
        showMessages: false,
        showSupportContact: true,
      },
      mode: "EMERGENCY_SUPPORT_OVERRIDE",
      restrictions: {
        blockAppInstall: false,
        blockSafeMode: false,
        blockSettings: false,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
  {
    key: "DEFAULT_SCHOOL",
    name: "Default School Mode",
    rules: {
      approvedAppPackageIds: [],
      defaultWebAccess: "DENY",
      launcher: {
        showMessages: true,
        showSupportContact: true,
      },
      mode: "DEFAULT_SCHOOL",
      restrictions: {
        blockAppInstall: true,
        blockSafeMode: true,
        blockSettings: true,
      },
      urlAllowlist: [],
      urlBlocklist: [],
      webShortcuts: [],
    },
  },
];
