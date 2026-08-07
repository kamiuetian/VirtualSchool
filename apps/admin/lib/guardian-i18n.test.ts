import { describe, expect, it } from "vitest";
import { guardianText } from "./guardian-i18n";

describe("guardianText", () => {
  it("uses Urdu translations and deterministically falls back to English", () => {
    expect(guardianText("ur", "Language")).toBe("زبان");
    expect(guardianText("ur", "School-provided notice")).toBe(
      "School-provided notice",
    );
    expect(guardianText("en", "Language")).toBe("Language");
  });
});
