import { describe, expect, it } from "vitest";
import { matchesEducationalVideo } from "./educational-video-evaluator";

describe("matchesEducationalVideo", () => {
  const entries = [
    { kind: "VIDEO", value: "lesson123", scope: "TENANT" },
    { kind: "PLAYLIST", value: "course456", scope: "GRADE", scopeId: "8" },
    { kind: "CHANNEL", value: "UCschool", scope: "CLASS", scopeId: "class-1" },
    {
      kind: "DOMAIN",
      value: "media.school.edu",
      scope: "MODE",
      scopeId: "EXAM",
    },
  ] as const;

  it("matches exact videos, playlists, channels, and educational domains", () => {
    expect(
      matchesEducationalVideo("https://www.youtube.com/watch?v=lesson123", [
        ...entries,
      ])?.kind,
    ).toBe("VIDEO");
    expect(
      matchesEducationalVideo("https://youtube.com/playlist?list=course456", [
        ...entries,
      ])?.kind,
    ).toBe("PLAYLIST");
    expect(
      matchesEducationalVideo("https://youtube.com/channel/UCschool", [
        ...entries,
      ])?.kind,
    ).toBe("CHANNEL");
    expect(
      matchesEducationalVideo("https://cdn.media.school.edu/lesson/1", [
        ...entries,
      ])?.kind,
    ).toBe("DOMAIN");
  });

  it("does not widen one video approval to the platform", () => {
    expect(
      matchesEducationalVideo("https://www.youtube.com/watch?v=unapproved", [
        ...entries,
      ]),
    ).toBeNull();
    expect(
      matchesEducationalVideo("https://www.youtube.com/", [...entries]),
    ).toBeNull();
    expect(
      matchesEducationalVideo("https://media.school.edu.evil.example/lesson", [
        ...entries,
      ]),
    ).toBeNull();
  });
});
