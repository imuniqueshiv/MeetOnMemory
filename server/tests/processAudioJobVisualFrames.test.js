import { describe, it, expect, vi, beforeEach } from "vitest";
import processAudioJob from "../jobs/processAudioJob.js";
import { aiResultsQueue } from "../services/queueService.js";
import { generateMoMDetailed } from "../services/GenerativeAIService.js";
import TranscriptChapter from "../models/transcriptChapterModel.js";

vi.mock("../services/queueService.js", () => ({
  aiResultsQueue: {
    isActive: true,
    add: vi.fn(),
  },
}));

vi.mock("../services/GenerativeAIService.js", () => ({
  generateMoMDetailed: vi.fn(),
}));

vi.mock("../models/transcriptChapterModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

describe("processAudioJob with visual frames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch visual frames and pass them to generateMoMDetailed", async () => {
    const meetingId = "test-meeting-123";
    const jobData = {
      meetingId,
      transcript: "This is a test transcript.",
      date: "2026-08-30",
      title: "Test Meeting",
      customInstructions: "Test instruction",
      userId: "user-123",
    };

    TranscriptChapter.findOne.mockResolvedValueOnce({
      chapters: [
        {
          startTime: 1672531200000,
          summary: "Architecture diagram",
          extractedText: "NodeJS -> React",
          imageUrl: "/uploads/frames/test.jpg",
        },
      ],
    });

    generateMoMDetailed.mockResolvedValueOnce({
      mom: { title: "Generated Title", summary: "Generated Summary" },
      generation: {},
    });

    await processAudioJob({ data: jobData });

    expect(TranscriptChapter.findOne).toHaveBeenCalledWith({
      meeting: meetingId,
    });
    expect(generateMoMDetailed).toHaveBeenCalledWith(
      "This is a test transcript.",
      "2026-08-30",
      "Test Meeting",
      "Test instruction",
      expect.stringContaining("Architecture diagram"),
    );
    expect(generateMoMDetailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.stringContaining("NodeJS -> React"),
    );

    expect(aiResultsQueue.add).toHaveBeenCalledWith(
      "ai-mom-result-job",
      expect.objectContaining({
        meetingId,
        structuredMoM: {
          title: "Generated Title",
          summary: "Generated Summary",
        },
      }),
    );
  });

  it("should generate MoM without visualFramesText if no visual chapters exist", async () => {
    const meetingId = "test-meeting-456";
    const jobData = {
      meetingId,
      transcript: "This is another test transcript.",
    };

    TranscriptChapter.findOne.mockResolvedValueOnce(null);

    generateMoMDetailed.mockResolvedValueOnce({
      mom: {},
      generation: {},
    });

    await processAudioJob({ data: jobData });

    expect(generateMoMDetailed).toHaveBeenCalledWith(
      "This is another test transcript.",
      undefined,
      undefined,
      undefined,
      null,
    );
  });
});
