import { describe, it, expect } from "vitest";
import { normalizeImageUrl } from "../utils/imageUrl.js";

describe("normalizeImageUrl", () => {
  it("allows empty string to clear branding", () => {
    expect(normalizeImageUrl("")).toEqual({ ok: true, value: "" });
  });

  it("accepts https URLs", () => {
    expect(
      normalizeImageUrl("https://cdn.example.com/a.png", "Logo URL"),
    ).toEqual({
      ok: true,
      value: "https://cdn.example.com/a.png",
    });
  });

  it("rejects non-http protocols", () => {
    const result = normalizeImageUrl("javascript:alert(1)", "Logo URL");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/http or https/i);
  });

  it("rejects malformed URLs", () => {
    const result = normalizeImageUrl("not a url", "Banner URL");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/valid URL/i);
  });
});
