import { describe, it, expect } from "vitest";
import { validateRedirect } from "./validateRedirect";

describe("validateRedirect", () => {
  const DEFAULT_FALLBACK = "/dashboard";

  it("allows valid internal routes", () => {
    expect(validateRedirect("/settings")).toBe("/settings");
    expect(validateRedirect("/profile?user=123")).toBe("/profile?user=123");
    expect(validateRedirect("/some/deep/path")).toBe("/some/deep/path");
  });

  it("rejects external URLs", () => {
    expect(validateRedirect("https://google.com")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect("http://evil.com/login")).toBe(DEFAULT_FALLBACK);
  });

  it("rejects protocol-relative URLs (//example.com)", () => {
    expect(validateRedirect("//evil.com")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect("//google.com/test")).toBe(DEFAULT_FALLBACK);
  });

  it("rejects absolute URLs with alternative schemes", () => {
    expect(validateRedirect("javascript:alert(1)")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect("data:text/html,<html>")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect("file:///etc/passwd")).toBe(DEFAULT_FALLBACK);
  });

  it("rejects malformed or empty redirect values", () => {
    expect(validateRedirect("")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect(null)).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect(undefined)).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect({})).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect(123)).toBe(DEFAULT_FALLBACK);
  });

  it("rejects paths that do not start with a slash", () => {
    expect(validateRedirect("dashboard")).toBe(DEFAULT_FALLBACK);
    expect(validateRedirect("api/v1/users")).toBe(DEFAULT_FALLBACK);
  });

  it("uses custom fallback if provided when validation fails", () => {
    expect(validateRedirect("https://evil.com", "/organizations")).toBe(
      "/organizations",
    );
    expect(validateRedirect("//hacked.com", "/organizations")).toBe(
      "/organizations",
    );
  });
});
