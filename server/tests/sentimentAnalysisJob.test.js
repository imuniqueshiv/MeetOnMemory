import { jest } from "@jest/globals";

const mockPipelineFn = jest.fn();

jest.unstable_mockModule("@xenova/transformers", () => ({
  pipeline: jest.fn().mockResolvedValue(mockPipelineFn),
  env: { useBrowserCache: false },
}));

const mockFindById = jest.fn();

jest.unstable_mockModule("../models/transcriptModel.js", () => ({
  default: {
    findById: mockFindById,
  },
}));

const sentimentAnalysisJob = (await import("../jobs/sentimentAnalysisJob.js"))
  .default;
const { pipeline } = await import("@xenova/transformers");
const Transcript = (await import("../models/transcriptModel.js")).default; // eslint-disable-line no-unused-vars

describe("sentimentAnalysisJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if transcript is not found", async () => {
    mockFindById.mockResolvedValueOnce(null);

    await expect(
      sentimentAnalysisJob({ data: { transcriptId: "123" } }),
    ).rejects.toThrow("Transcript 123 not found");
  });

  it("should skip if transcript has no segments", async () => {
    mockFindById.mockResolvedValueOnce({
      _id: "123",
      segments: [],
    });

    const result = await sentimentAnalysisJob({
      data: { transcriptId: "123" },
    });

    expect(result).toEqual({ success: true, skipped: true });
    expect(pipeline).not.toHaveBeenCalled();
  });

  it("should calculate sentiment for segments and update transcript", async () => {
    const mockSave = jest.fn().mockResolvedValueOnce(true);

    const mockTranscript = {
      _id: "123",
      segments: [{ text: "This is great" }, { text: "I am disappointed" }],
      save: mockSave,
    };

    mockFindById.mockResolvedValueOnce(mockTranscript);

    // Mock pipeline logic to return positive for first segment and negative for second
    mockPipelineFn
      .mockResolvedValueOnce([{ label: "POSITIVE", score: 0.9 }])
      .mockResolvedValueOnce([{ label: "NEGATIVE", score: 0.8 }]);

    const result = await sentimentAnalysisJob({
      data: { transcriptId: "123" },
    });

    expect(result.success).toBe(true);
    expect(pipeline).toHaveBeenCalledWith("sentiment-analysis");
    expect(mockPipelineFn).toHaveBeenCalledTimes(2);

    // Assert segment updates
    expect(mockTranscript.segments[0].sentimentScore).toBe(0.9);
    expect(mockTranscript.segments[0].emotionTags).toEqual(["POSITIVE"]);

    // Negative mapping logic makes it -0.8
    expect(mockTranscript.segments[1].sentimentScore).toBe(-0.8);
    expect(mockTranscript.segments[1].emotionTags).toEqual(["NEGATIVE"]);

    // Assert overall calculations: (0.9 + -0.8) / 2 = 0.05 (POSITIVE)
    expect(mockTranscript.overallSentiment).toBeCloseTo(0.05);
    expect(mockTranscript.overallEmotion).toBe("POSITIVE");

    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
