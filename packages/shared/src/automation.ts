export type AutomationTrigger = "DEVICE_OFFLINE" | "POLICY_FAILURE_REPEATED";
export type AutomationAction = "NOTIFY" | "CREATE_TICKET";

export type AutomationRuleSummary = {
  id: string;
  tenantId: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: { threshold: number; windowMinutes: number };
  action: AutomationAction;
  actionConfig: { title: string; severity: string };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AutomationTestResult = {
  matched: boolean;
  matchCount: number;
  sampledTargets: Array<{ id: string; label: string; evidenceCount: number }>;
  sideEffects: false;
};
