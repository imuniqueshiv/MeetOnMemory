import mongoose from "mongoose";
import { jest } from "@jest/globals";

// Mock GenerativeAIService
jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateText: jest.fn(),
  parseJsonOutput: jest.fn((str) => JSON.parse(str)),
}));

import TranslationCache from "../models/translationCacheModel.js";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";

let translateContent, getSupportedLanguages, generateText;

describe("translationService", () => {
  beforeAll(async () => {
    const translationService =
      await import("../services/translationService.js");
    translateContent = translationService.translateContent;
    getSupportedLanguages = translationService.getSupportedLanguages;

    const GenerativeAIService =
      await import("../services/GenerativeAIService.js");
    generateText = GenerativeAIService.generateText;
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSupportedLanguages", () => {
    it("returns an array of languages", () => {
      const langs = getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs.length).toBeGreaterThan(0);
      expect(langs).toContain("Spanish");
    });
  });

  describe("translateContent", () => {
    const meetingId = new mongoose.Types.ObjectId();

    it("returns cached content if it exists", async () => {
      jest.spyOn(TranslationCache, "findOne").mockResolvedValue({
        translatedContent: "Bonjour",
      });

      const result = await translateContent(meetingId, "summary", "French");

      expect(TranslationCache.findOne).toHaveBeenCalledWith({
        meeting: meetingId,
        sourceType: "summary",
        targetLanguage: "French",
      });
      expect(result).toBe("Bonjour");
      expect(generateText).not.toHaveBeenCalled();
    });

    it("translates summary on cache miss and saves to cache", async () => {
      jest.spyOn(TranslationCache, "findOne").mockResolvedValue(null);
      jest.spyOn(TranslationCache, "create").mockResolvedValue({});

      const mockMeeting = {
        _id: meetingId,
        summary: "This is a summary.",
      };
      jest.spyOn(Meeting, "findById").mockResolvedValue(mockMeeting);

      generateText.mockResolvedValue("Ceci est un résumé.");

      const result = await translateContent(meetingId, "summary", "French");

      expect(generateText).toHaveBeenCalled();
      expect(result).toBe("Ceci est un résumé.");
      expect(TranslationCache.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meeting: meetingId,
          sourceType: "summary",
          targetLanguage: "French",
          translatedContent: "Ceci est un résumé.",
        }),
      );
    });

    it("translates transcript on cache miss and parses batch correctly", async () => {
      jest.spyOn(TranslationCache, "findOne").mockResolvedValue(null);
      jest.spyOn(TranslationCache, "create").mockResolvedValue({});

      const mockTranscript = {
        _id: new mongoose.Types.ObjectId(),
        segments: [
          { text: "Hello", speaker: "Alice", startTime: 0, endTime: 1 },
        ],
      };
      jest.spyOn(Transcript, "findOne").mockResolvedValue(mockTranscript);

      generateText.mockResolvedValue(
        '[{"text": "Bonjour", "speaker": "Alice", "startTime": 0, "endTime": 1}]',
      );

      const result = await translateContent(meetingId, "transcript", "French");

      expect(generateText).toHaveBeenCalled();
      expect(result).toEqual([
        { text: "Bonjour", speaker: "Alice", startTime: 0, endTime: 1 },
      ]);
      expect(TranslationCache.create).toHaveBeenCalled();
    });
  });
});
