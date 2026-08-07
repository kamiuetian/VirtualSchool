import { describe, expect, it } from "vitest";
import {
  resolvePolicy,
  simulateUrlPolicy,
  starterPolicyTemplates,
} from "./policy";

describe("resolvePolicy", () => {
  it("selects the highest precedence mode", () => {
    const result = resolvePolicy([
      {
        id: "default",
        mode: "DEFAULT_SCHOOL",
        policyVersion: 1,
        source: "tenant-default",
      },
      {
        id: "lost",
        mode: "LOST_DEVICE",
        policyVersion: 1,
        source: "device-status",
      },
      {
        id: "class",
        mode: "TIMETABLE_CLASS",
        policyVersion: 8,
        source: "class-schedule",
      },
    ]);

    expect(result.active.id).toBe("lost");
    expect(result.explanation).toContain("LOST_DEVICE");
  });

  it("uses policy version as a deterministic tiebreaker", () => {
    const result = resolvePolicy([
      {
        id: "class-v1",
        mode: "TIMETABLE_CLASS",
        policyVersion: 1,
        source: "class-schedule",
      },
      {
        id: "class-v2",
        mode: "TIMETABLE_CLASS",
        policyVersion: 2,
        source: "class-schedule",
      },
    ]);

    expect(result.active.id).toBe("class-v2");
  });

  it("includes all Phase 1 starter templates", () => {
    expect(starterPolicyTemplates.map((template) => template.key)).toEqual([
      "GRADE_1_3_LOCKDOWN",
      "GRADE_4_8_SUPERVISED",
      "HOMEWORK_MODE",
      "EXAM_STARTER",
      "LOST_DEVICE",
      "MAINTENANCE",
      "DEFAULT_SCHOOL",
    ]);
  });
});

describe("simulateUrlPolicy", () => {
  const rules = {
    defaultWebAccess: "DENY" as const,
    urlAllowlist: ["https://learning.example.edu/lessons/*"],
    urlBlocklist: ["https://learning.example.edu/lessons/blocked"],
  };

  it("gives a matching block rule precedence over an allow rule", () => {
    expect(
      simulateUrlPolicy(
        "https://learning.example.edu/lessons/blocked/1?student=secret",
        rules,
      ),
    ).toEqual({
      decision: "BLOCKED",
      effectiveAccess: "DENY",
      matchedRule: "https://learning.example.edu/lessons/blocked",
      reason: "BLOCKLIST",
    });
  });

  it("distinguishes a rule match from the default outcome", () => {
    expect(
      simulateUrlPolicy("https://learning.example.edu/lessons/1", rules)
        .decision,
    ).toBe("ALLOWED");
    expect(
      simulateUrlPolicy("https://elsewhere.example/", rules),
    ).toMatchObject({
      decision: "UNMATCHED",
      effectiveAccess: "DENY",
      matchedRule: null,
    });
  });
});
