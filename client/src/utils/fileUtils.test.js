import { describe, it, expect } from "vitest";
import { formatFileSize, isValidAudioFile } from "./fileUtils";

describe("fileUtils", () => {
  describe("formatFileSize", () => {
    it("formats 0 bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
    });
    it("formats KB correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });
    it("formats MB correctly", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
    });
    it("formats with decimals", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });
  });

  describe("isValidAudioFile", () => {
    it("returns false for null file", () => {
      expect(isValidAudioFile(null)).toBe(false);
    });

    it("returns true for valid extension", () => {
      const file = new File([""], "test.mp3", { type: "" });
      expect(isValidAudioFile(file)).toBe(true);
    });

    it("returns true for valid type", () => {
      const file = new File([""], "test.txt", { type: "audio/mp3" });
      expect(isValidAudioFile(file)).toBe(true);
    });

    it("returns false for invalid type and extension", () => {
      const file = new File([""], "test.txt", { type: "text/plain" });
      expect(isValidAudioFile(file)).toBe(false);
    });
  });
});
