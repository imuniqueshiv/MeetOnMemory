import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes script elements", () => {
    const sanitized = sanitizeHtml('<p>Hello</p><script>alert("xss")</script>');

    expect(sanitized).toContain("<p>Hello</p>");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("alert");
  });

  it("removes inline event handlers", () => {
    const sanitized = sanitizeHtml('<button onclick="alert(1)">Click</button>');

    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("alert(1)");
  });

  it("blocks dangerous URL protocols", () => {
    const sanitized = sanitizeHtml(
      '<a href="javascript:alert(1)">Bad link</a><img src="javascript:alert(2)" />',
    );

    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("Bad link");
  });

  it("preserves legitimate recap formatting and styling", () => {
    const sanitized = sanitizeHtml(
      '<div class="recap"><h2>Meeting recap</h2><p style="font-weight:bold">Summary</p><a href="https://example.com" target="_blank">Details</a></div>',
    );

    expect(sanitized).toContain('<h2>Meeting recap</h2>');
    expect(sanitized).toContain('class="recap"');
    expect(sanitized).toContain('style="font-weight:bold"');
    expect(sanitized).toContain('href="https://example.com"');
  });
});
