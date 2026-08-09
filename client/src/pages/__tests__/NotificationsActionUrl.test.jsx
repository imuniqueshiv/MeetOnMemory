import { describe, it, expect } from "vitest";
import { validateRedirect } from "../../utils/validateRedirect.js";

describe("Notifications actionUrl validation (#1215)", () => {
  it("validates internal action URLs correctly", () => {
    expect(validateRedirect("/meetings/meeting-123", null)).toBe(
      "/meetings/meeting-123",
    );
    expect(validateRedirect("/tasks/task-456", null)).toBe("/tasks/task-456");
    expect(validateRedirect("/reports/summary", null)).toBe("/reports/summary");
  });

  it("blocks external and unsafe action URLs", () => {
    expect(
      validateRedirect("https://phishing.com/steal-auth", null),
    ).toBeNull();
    expect(validateRedirect("//malicious-domain.com/login", null)).toBeNull();
    expect(
      validateRedirect("javascript:alert(document.cookie)", null),
    ).toBeNull();
    expect(validateRedirect("http://evil.com", null)).toBeNull();
  });
});
