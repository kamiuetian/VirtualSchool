export const learningModes = [
  "LOST_DEVICE",
  "EXAM",
  "EMERGENCY_SUPPORT_OVERRIDE",
  "TIMETABLE_CLASS",
  "HOMEWORK_AFTER_SCHOOL",
  "DEVICE_BASELINE",
  "DEFAULT_SCHOOL",
] as const;

export type LearningMode = (typeof learningModes)[number];

export const policyPrecedence: Record<LearningMode, number> = {
  LOST_DEVICE: 100,
  EXAM: 90,
  EMERGENCY_SUPPORT_OVERRIDE: 80,
  TIMETABLE_CLASS: 70,
  HOMEWORK_AFTER_SCHOOL: 60,
  DEVICE_BASELINE: 50,
  DEFAULT_SCHOOL: 10,
};

export type PolicyCandidate = {
  id: string;
  mode: LearningMode;
  source: string;
  policyVersion: number;
  startsAt?: string;
  endsAt?: string;
};

export type PolicyResolution = {
  active: PolicyCandidate;
  explanation: string;
  evaluated: PolicyCandidate[];
};

export type PolicyStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type PolicyMdmPublishStatus = "PUBLISHED" | "FAILED" | "SKIPPED";

export type PolicyRuleSet = {
  mode: LearningMode;
  approvedAppPackageIds: string[];
  webShortcuts: Array<{
    title: string;
    url: string;
  }>;
  urlAllowlist: string[];
  urlBlocklist: string[];
  defaultWebAccess: "ALLOW" | "DENY";
  launcher: {
    showMessages: boolean;
    showSupportContact: boolean;
  };
  restrictions: {
    blockSettings: boolean;
    blockAppInstall: boolean;
    blockSafeMode: boolean;
  };
};

export type PolicySummary = {
  id: string;
  tenantId: string;
  name: string;
  status: PolicyStatus;
  version: number;
  rules: PolicyRuleSet;
  mdmPolicyName?: string | null;
  mdmPublishStatus?: PolicyMdmPublishStatus | null;
  mdmPublishedAt?: string | null;
  mdmPublishError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PolicyPublishSummary = PolicySummary & {
  mdmPublishRequest?: Record<string, unknown> | null;
  mdmPublishResponse?: Record<string, unknown> | null;
};

export type PolicyVersionSummary = {
  id: string;
  policyId: string;
  version: number;
  snapshot: PolicyRuleSet;
  summary: string;
  actorId?: string | null;
  createdAt: string;
};

export type PolicyAssignmentScope =
  | "TENANT"
  | "GRADE"
  | "CLASS"
  | "STUDENT"
  | "DEVICE";

export type PolicyAssignmentSummary = {
  id: string;
  tenantId: string;
  policyId: string;
  policyName: string;
  policyVersion: number;
  policyStatus: PolicyStatus;
  scope: PolicyAssignmentScope;
  scopeId?: string | null;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  actorId?: string | null;
  createdAt: string;
};

export type ActivePolicyResolution = {
  deviceId: string;
  tenantId: string;
  activePolicy: PolicySummary;
  assignment: PolicyAssignmentSummary;
  explanation: string;
  evaluated: Array<{
    assignment: PolicyAssignmentSummary;
    mode: LearningMode;
    source: string;
    precedence: number;
  }>;
};

export type StarterPolicyTemplateKey =
  | "GRADE_1_3_LOCKDOWN"
  | "GRADE_4_8_SUPERVISED"
  | "HOMEWORK_MODE"
  | "EXAM_STARTER"
  | "LOST_DEVICE"
  | "MAINTENANCE"
  | "DEFAULT_SCHOOL";

export type StarterPolicyTemplate = {
  key: StarterPolicyTemplateKey;
  name: string;
  rules: PolicyRuleSet;
};

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

export function resolvePolicy(candidates: PolicyCandidate[]): PolicyResolution {
  if (candidates.length === 0) {
    throw new Error("At least one policy candidate is required");
  }

  const sorted = [...candidates].sort((left, right) => {
    const precedenceDiff =
      policyPrecedence[right.mode] - policyPrecedence[left.mode];
    if (precedenceDiff !== 0) {
      return precedenceDiff;
    }

    return right.policyVersion - left.policyVersion;
  });

  const active = sorted[0];

  if (!active) {
    throw new Error("Policy resolution failed");
  }

  return {
    active,
    evaluated: sorted,
    explanation: `${active.mode} from ${active.source} won with precedence ${policyPrecedence[active.mode]} and policy version ${active.policyVersion}.`,
  };
}
