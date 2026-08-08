import { describe, expect, it } from "vitest";
import {
  coreText,
  missingCoreTranslationKeys,
  supportedCoreLocale,
} from "./core-i18n";

describe("core localization", () => {
  it("keeps the Urdu core catalog complete", () => {
    expect(missingCoreTranslationKeys("ur")).toEqual([]);
  });

  it("falls back deterministically to English for unsupported locales", () => {
    expect(supportedCoreLocale("fr")).toBe("en");
    expect(coreText(supportedCoreLocale("fr"), "dashboard")).toBe("Dashboard");
  });
});
