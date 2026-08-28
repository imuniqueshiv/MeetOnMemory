import { generateSharePayload, handleShare } from "../shareUtils.js";
import { vi, describe, it, expect, beforeAll, afterEach } from "vitest";

describe("shareUtils", () => {
  const mockBadge = {
    id: "123",
    name: "The Punctual Pro",
    tier: "Gold",
    description: "Started 5 meetings exactly on time",
  };

  beforeAll(() => {
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });
  });

  describe("generateSharePayload", () => {
    it("should generate the correct payload for a badge", () => {
      const payload = generateSharePayload(mockBadge);

      expect(payload.title).toBe(
        "I just earned the The Punctual Pro badge on MeetOnMemory!",
      );
      expect(payload.text).toContain(
        "Gold tier achievement: Started 5 meetings exactly on time",
      );
      expect(payload.url).toBe("http://localhost:3000/badges#badge-123");
    });
  });

  describe("handleShare", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should use navigator.share if available", async () => {
      const shareMock = vi.fn().mockResolvedValue(true);
      vi.stubGlobal("navigator", { share: shareMock });

      const result = await handleShare(mockBadge);
      expect(result).toBe(true);
      expect(shareMock).toHaveBeenCalledWith(generateSharePayload(mockBadge));
    });

    it("should fallback to clipboard if navigator.share is undefined", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(true);
      vi.stubGlobal("navigator", {
        clipboard: { writeText: writeTextMock },
      });

      const result = await handleShare(mockBadge);
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalled();

      const clipboardArgs = writeTextMock.mock.calls[0][0];
      expect(clipboardArgs).toContain("The Punctual Pro");
      expect(clipboardArgs).toContain("http://localhost:3000/badges#badge-123");
    });
  });
});
