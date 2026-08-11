import {
  buildCalendarOAuthClientRedirect,
  validateInternalAppPath,
  getTrustedClientOrigin,
  CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
} from "../utils/calendarOAuthRedirect.js";

describe("calendarOAuthRedirect", () => {
  const originalClientUrl = process.env.CLIENT_URL;

  afterEach(() => {
    process.env.CLIENT_URL = originalClientUrl;
  });

  describe("validateInternalAppPath", () => {
    it("allows internal paths with query strings", () => {
      expect(validateInternalAppPath("/settings?sync=success")).toBe(
        "/settings?sync=success",
      );
    });

    it("rejects external and malformed destinations", () => {
      expect(validateInternalAppPath("https://evil.com")).toBe(
        CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
      );
      expect(validateInternalAppPath("//evil.com")).toBe(
        CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
      );
      expect(validateInternalAppPath("settings")).toBe(
        CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
      );
    });
  });

  describe("buildCalendarOAuthClientRedirect", () => {
    it("joins trusted origin with a validated internal path", () => {
      process.env.CLIENT_URL = "https://app.example.com/extra";
      expect(buildCalendarOAuthClientRedirect("/settings?sync=success")).toBe(
        "https://app.example.com/settings?sync=success",
      );
    });

    it("falls back when path is unsafe", () => {
      process.env.CLIENT_URL = "https://app.example.com";
      expect(buildCalendarOAuthClientRedirect("https://evil.com")).toBe(
        "https://app.example.com/settings",
      );
    });

    it("falls back to localhost origin when CLIENT_URL is invalid", () => {
      process.env.CLIENT_URL = "not-a-url";
      expect(getTrustedClientOrigin()).toBe("http://localhost:5173");
      expect(buildCalendarOAuthClientRedirect("/settings?error=x")).toBe(
        "http://localhost:5173/settings?error=x",
      );
    });
  });
});
