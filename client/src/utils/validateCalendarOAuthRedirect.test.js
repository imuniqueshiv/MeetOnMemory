import { describe, it, expect } from "vitest";
import {
  validateCalendarOAuthAuthUrl,
  CALENDAR_OAUTH_FALLBACK_PATH,
} from "./validateCalendarOAuthRedirect.js";

describe("validateCalendarOAuthAuthUrl", () => {
  it("allows Google OAuth https URLs", () => {
    const url =
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&redirect_uri=x";
    expect(validateCalendarOAuthAuthUrl(url)).toBe(url);
  });

  it("allows Microsoft OAuth https URLs", () => {
    const url =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=abc";
    expect(validateCalendarOAuthAuthUrl(url)).toBe(url);
  });

  it("rejects external or untrusted hosts", () => {
    expect(validateCalendarOAuthAuthUrl("https://evil.com/phish")).toBeNull();
    expect(
      validateCalendarOAuthAuthUrl("https://accounts.google.com.evil.com/o"),
    ).toBeNull();
  });

  it("rejects non-https and malformed values", () => {
    expect(
      validateCalendarOAuthAuthUrl(
        "http://accounts.google.com/o/oauth2/v2/auth",
      ),
    ).toBeNull();
    expect(validateCalendarOAuthAuthUrl("javascript:alert(1)")).toBeNull();
    expect(validateCalendarOAuthAuthUrl("//accounts.google.com/x")).toBeNull();
    expect(validateCalendarOAuthAuthUrl("")).toBeNull();
    expect(validateCalendarOAuthAuthUrl(null)).toBeNull();
  });

  it("exposes a safe internal fallback path", () => {
    expect(CALENDAR_OAUTH_FALLBACK_PATH).toBe("/settings");
  });
});
