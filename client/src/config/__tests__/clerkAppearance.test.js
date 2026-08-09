import { describe, it, expect } from "vitest";
import {
  meetOnMemoryClerkAppearance,
  meetOnMemoryClerkInitialValues,
  meetOnMemoryClerkLocalization,
} from "../../config/clerkAppearance.js";

describe("Clerk appearance theme", () => {
  it("defines MeetOnMemory brand colors for auth surfaces", () => {
    expect(meetOnMemoryClerkAppearance.variables.colorPrimary).toBe("#6366f1");
    expect(meetOnMemoryClerkAppearance.variables.colorBackground).toBe(
      "#0f172a",
    );
    expect(meetOnMemoryClerkAppearance.variables.borderRadius).toBe("0.75rem");
    expect(meetOnMemoryClerkAppearance.layout.termsPageUrl).toBe("/terms");
    expect(meetOnMemoryClerkAppearance.layout.privacyPageUrl).toBe("/privacy");
  });

  it("hides phone authentication fields and optional phone capture", () => {
    expect(meetOnMemoryClerkAppearance.layout.showOptionalFields).toBe(false);
    expect(meetOnMemoryClerkAppearance.options.showOptionalFields).toBe(false);
    expect(
      meetOnMemoryClerkAppearance.elements.formFieldRow__phoneNumber,
    ).toEqual({ display: "none" });
    expect(meetOnMemoryClerkAppearance.elements.phoneInputBox).toEqual({
      display: "none",
    });
    expect(meetOnMemoryClerkInitialValues.phoneNumber).toBeNull();
    expect(
      meetOnMemoryClerkLocalization.signIn.start.actionLink__use_phone,
    ).toBe("");
    expect(
      meetOnMemoryClerkLocalization.signUp.start.actionLink__use_phone,
    ).toBe("");
  });
});
