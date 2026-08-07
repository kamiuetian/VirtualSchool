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

export type UrlPolicySimulation = {
  decision: "ALLOWED" | "BLOCKED" | "UNMATCHED";
  effectiveAccess: "ALLOW" | "DENY";
  reason: "ALLOWLIST" | "BLOCKLIST" | "DEFAULT_ALLOW" | "DEFAULT_DENY";
  matchedRule: string | null;
  policyId: string;
  policyVersion: number;
  url: string;
};

export type BlockedDomainEventInput = {
  deviceId?: string;
  domain: string;
  matchedRule?: string;
  occurredAt: string;
  policyId: string;
  policyVersion: number;
  reason: string;
};

export type BlockedDomainAggregate = {
  count: number;
  domain: string;
  lastOccurredAt: string;
  reasons: string[];
};

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
    blockFactoryReset?: boolean;
  };
  android?: {
    systemUpdate?:
      | { type: "AUTOMATIC" | "POSTPONE" }
      | { type: "WINDOWED"; startMinutes: number; endMinutes: number };
    kioskCustomization?: {
      systemNavigation:
        | "NAVIGATION_DISABLED"
        | "HOME_BUTTON_ONLY"
        | "NAVIGATION_ENABLED";
      statusBar:
        | "NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED"
        | "SYSTEM_INFO_ONLY"
        | "NOTIFICATIONS_AND_SYSTEM_INFO_ENABLED";
      powerButtonActions: "POWER_BUTTON_BLOCKED" | "POWER_BUTTON_AVAILABLE";
    };
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

export type ExamReadinessIssue =
  | "OFFLINE"
  | "LOW_BATTERY"
  | "WRONG_POLICY"
  | "MISSING_APP"
  | "UNSUPPORTED_BROWSER";

export type ExamDeviceReadiness = {
  deviceId: string;
  serialNumber: string;
  ready: boolean;
  issues: ExamReadinessIssue[];
  batteryLevel: number | null;
  policyVersion: number | null;
  browserVersion: string | null;
  missingAppPackageIds: string[];
  lastReportedAt: string | null;
};

export type ExamReadinessSummary = {
  assignmentId: string;
  policyId: string;
  policyVersion: number;
  checkedAt: string;
  ready: number;
  blocked: number;
  devices: ExamDeviceReadiness[];
};

export type AssessmentLaunchSummary = {
  assignmentId: string;
  resourceType: "APP" | "URL";
  resource: string;
  queued: number;
  skipped: number;
  commandIds: string[];
};

export type ExamIntegrityEventType =
  | "APP_EXIT_ATTEMPT"
  | "NETWORK_LOSS"
  | "POLICY_TAMPER"
  | "SCREEN_PINNING_EXIT"
  | "UNEXPECTED_RESTART";

export type ExamReport = {
  assignmentId: string;
  policyId: string;
  policyVersion: number;
  scope: PolicyAssignmentScope;
  scopeId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualEnd: string | null;
  generatedAt: string;
  attendance: { targeted: number; participated: number; absent: number };
  readiness: { ready: number; blocked: number; checkedAt: string | null };
  integrityEvents: Array<{ deviceId: string; type: ExamIntegrityEventType; occurredAt: string }>;
  failures: Array<{ deviceId: string; reason: string; occurredAt: string }>;
  unlocks: Array<{ deviceId: string; actorId: string | null; reason: string; durationMinutes: number; occurredAt: string }>;
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

export function simulateUrlPolicy(
  url: string,
  rules: Pick<
    PolicyRuleSet,
    "defaultWebAccess" | "urlAllowlist" | "urlBlocklist"
  >,
): Omit<UrlPolicySimulation, "policyId" | "policyVersion" | "url"> {
  const parsed = parseHttpUrl(url);
  if (!parsed) {
    throw new Error("A valid HTTP(S) URL without credentials is required");
  }
  const blocked = rules.urlBlocklist.find((rule) =>
    matchesUrlRule(parsed, rule),
  );
  if (blocked)
    return {
      decision: "BLOCKED",
      effectiveAccess: "DENY",
      matchedRule: blocked,
      reason: "BLOCKLIST",
    };
  const allowed = rules.urlAllowlist.find((rule) =>
    matchesUrlRule(parsed, rule),
  );
  if (allowed)
    return {
      decision: "ALLOWED",
      effectiveAccess: "ALLOW",
      matchedRule: allowed,
      reason: "ALLOWLIST",
    };
  return {
    decision: "UNMATCHED",
    effectiveAccess: rules.defaultWebAccess,
    matchedRule: null,
    reason:
      rules.defaultWebAccess === "ALLOW" ? "DEFAULT_ALLOW" : "DEFAULT_DENY",
  };
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function matchesUrlRule(url: URL, rawRule: string): boolean {
  const rule = rawRule.trim();
  if (!rule) return false;
  const wildcard = rule.endsWith("*");
  const parsedRule = parseHttpUrl(wildcard ? rule.slice(0, -1) : rule);
  if (
    !parsedRule ||
    parsedRule.protocol !== url.protocol ||
    parsedRule.hostname.toLowerCase() !== url.hostname.toLowerCase() ||
    effectivePort(parsedRule) !== effectivePort(url)
  )
    return false;
  const rulePath = parsedRule.pathname || "/";
  const urlPath = url.pathname || "/";
  if (wildcard) return urlPath.toLowerCase().startsWith(rulePath.toLowerCase());
  return (
    urlPath.toLowerCase() === rulePath.toLowerCase() ||
    (rulePath.endsWith("/")
      ? urlPath.toLowerCase().startsWith(rulePath.toLowerCase())
      : urlPath.toLowerCase().startsWith(`${rulePath.toLowerCase()}/`))
  );
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}
