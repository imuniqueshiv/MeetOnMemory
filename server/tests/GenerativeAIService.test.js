import { jest } from "@jest/globals";

const mockGenerateContent = jest.fn();

jest.unstable_mockModule("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

const mockLocalSummarizer = jest.fn();

jest.unstable_mockModule("@xenova/transformers", () => ({
  pipeline: jest.fn().mockResolvedValue(mockLocalSummarizer),
  env: { useBrowserCache: false },
}));

const { pipeline } = await import("@xenova/transformers");
const { GoogleGenerativeAI } = await import("@google/generative-ai"); // eslint-disable-line no-unused-vars
const { generateMoMWithAI, buildHumanReadableMoM, normalizeMoM } =
  await import("../services/GenerativeAIService.js");

describe("GenerativeAIService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateMoMWithAI", () => {
    it("should successfully generate a structured MoM using Gemini", async () => {
      const mockMoM = {
        title: "Test Meeting",
        date: "2026-07-16",
        summary: "This is a summary",
        agenda: ["Point 1"],
        key_discussions: ["Discussion 1"],
        decisions: ["Decision 1"],
        action_items: ["Action 1"],
        questions_raised: ["Question 1"],
        keywords: ["Test"],
        attendees: ["John Doe"],
        notes: "No notes",
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockMoM),
        },
      });

      const result = await generateMoMWithAI(
        "Transcript text...",
        "2026-07-16",
        "Test Meeting",
      );

      expect(result).toEqual(mockMoM);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      // Ensure it did not fallback to local summarization model
      expect(pipeline).not.toHaveBeenCalled();
    });

    it("should fallback to local summarization if Gemini throws an error", async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error("Gemini API Error"));

      mockLocalSummarizer.mockResolvedValueOnce([
        { summary_text: "Local fallback summary" },
      ]);

      const result = await generateMoMWithAI(
        "Transcript text...",
        "2026-07-16",
        "Test Meeting",
      );

      expect(result.summary).toBe("Local fallback summary");
      expect(pipeline).toHaveBeenCalledWith(
        "summarization",
        "Xenova/distilbart-cnn-6-6",
      );
      expect(mockLocalSummarizer).toHaveBeenCalledTimes(1);
    });
  });

  describe("normalizeMoM", () => {
    it("should add default arrays if missing in AI output", () => {
      const partialMoM = { title: "Title", date: "2026-07-16" };
      const result = normalizeMoM(partialMoM, "Default Title", "2026-07-16");

      expect(result.agenda).toEqual([]);
      expect(result.action_items).toEqual([]);
      expect(result.summary).toBe("");
    });
  });

  describe("buildHumanReadableMoM", () => {
    it("should correctly convert a structured MoM object to formatted text", () => {
      const mom = {
        title: "Test",
        date: "2026-07-16",
        summary: "Summary",
        agenda: ["Agenda 1"],
        key_discussions: [],
        decisions: [],
        action_items: ["Do this"],
        questions_raised: [],
        keywords: [],
        attendees: ["Alice", "Bob"],
        notes: "",
      };

      const result = buildHumanReadableMoM(mom);
      expect(result).toContain("Test");
      expect(result).toContain("Summary");
      expect(result).toContain("1. Agenda 1");
      expect(result).toContain("1. Do this");
      expect(result).toContain("Alice, Bob");
    });
  });
});
