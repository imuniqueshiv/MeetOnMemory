import { describe, it, expect } from "vitest";
import { sanitizeImageUrl, validateImageUrl } from "../imageUrl.js";

describe("validateImageUrl", () => {
  it("allows empty values for placeholder fallback", () => {
    expect(validateImageUrl("")).toBe("");
    expect(validateImageUrl("   ")).toBe("");
  });

  it("accepts http(s) URLs", () => {
    expect(
      validateImageUrl("https://cdn.example.com/logo.png", "Logo URL"),
    ).toBe("");
    expect(
      validateImageUrl("http://cdn.example.com/banner.jpg", "Banner URL"),
    ).toBe("");
  });

  it("rejects non-http protocols", () => {
    expect(validateImageUrl("ftp://cdn.example.com/a.png", "Logo URL")).toBe(
      "Logo URL must use http or https.",
    );
  });

  it("rejects invalid URLs", () => {
    expect(validateImageUrl("not-a-url", "Banner URL")).toBe(
      "Banner URL must be a valid URL starting with http:// or https://.",
    );
  });
});

describe("sanitizeImageUrl", () => {
  it("returns safe http(s) image URLs", () => {
    expect(sanitizeImageUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
    expect(sanitizeImageUrl("http://cdn.example.com/banner.jpg")).toBe(
      "http://cdn.example.com/banner.jpg",
    );
  });

  it("rejects unsafe protocols", () => {
    expect(sanitizeImageUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeImageUrl("data:text/html,<svg></svg>")).toBe("");
    expect(sanitizeImageUrl("file:///tmp/logo.png")).toBe("");
    expect(sanitizeImageUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("rejects malformed values", () => {
    expect(sanitizeImageUrl("not-a-url")).toBe("");
    expect(sanitizeImageUrl("")).toBe("");
    expect(sanitizeImageUrl(null)).toBe("");
  });
});
