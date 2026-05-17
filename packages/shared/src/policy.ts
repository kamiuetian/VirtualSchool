export const learningModes = [
  "LOST_DEVICE",
  "EXAM",
  "EMERGENCY_SUPPORT_OVERRIDE",
  "TIMETABLE_CLASS",
  "HOMEWORK_AFTER_SCHOOL",
  "DEVICE_BASELINE",
  "DEFAULT_SCHOOL"
] as const;

export type LearningMode = (typeof learningModes)[number];

export const policyPrecedence: Record<LearningMode, number> = {
  LOST_DEVICE: 100,
  EXAM: 90,
  EMERGENCY_SUPPORT_OVERRIDE: 80,
  TIMETABLE_CLASS: 70,
  HOMEWORK_AFTER_SCHOOL: 60,
  DEVICE_BASELINE: 50,
  DEFAULT_SCHOOL: 10
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

export function resolvePolicy(candidates: PolicyCandidate[]): PolicyResolution {
  if (candidates.length === 0) {
    throw new Error("At least one policy candidate is required");
  }

  const sorted = [...candidates].sort((left, right) => {
    const precedenceDiff = policyPrecedence[right.mode] - policyPrecedence[left.mode];
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
    explanation: `${active.mode} from ${active.source} won with precedence ${policyPrecedence[active.mode]} and policy version ${active.policyVersion}.`
  };
}
