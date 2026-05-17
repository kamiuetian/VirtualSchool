import { describe, expect, it } from "vitest";
import { resolvePolicy } from "./policy";

describe("resolvePolicy", () => {
  it("selects the highest precedence mode", () => {
    const result = resolvePolicy([
      {
        id: "default",
        mode: "DEFAULT_SCHOOL",
        policyVersion: 1,
        source: "tenant-default"
      },
      {
        id: "lost",
        mode: "LOST_DEVICE",
        policyVersion: 1,
        source: "device-status"
      },
      {
        id: "class",
        mode: "TIMETABLE_CLASS",
        policyVersion: 8,
        source: "class-schedule"
      }
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
        source: "class-schedule"
      },
      {
        id: "class-v2",
        mode: "TIMETABLE_CLASS",
        policyVersion: 2,
        source: "class-schedule"
      }
    ]);

    expect(result.active.id).toBe("class-v2");
  });
});
