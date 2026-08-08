import { describe, it, expect } from "vitest";
import { sanitizeExportText, sanitizeExportFilename } from "../useExport.js";

describe("useExport XSS Sanitization (#1305)", () => {
  it("strips script tags and inline event handlers from exported text", () => {
    const maliciousInput =
      '<script>alert("xss")</script><img src="x" onerror="alert(1)">Meeting Title';
    const cleaned = sanitizeExportText(maliciousInput);

    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain('onerror="alert(1)"');
    expect(cleaned).toContain("Meeting Title");
  });

  it("sanitizes export filenames to remove illegal and script characters", () => {
    const maliciousFilename = "<script>bad</script>report:v1?.pdf";
    const safeFilename = sanitizeExportFilename(maliciousFilename);

    expect(safeFilename).not.toContain("<script>");
    expect(safeFilename).not.toContain(":");
    expect(safeFilename).not.toContain("?");
  });
});
