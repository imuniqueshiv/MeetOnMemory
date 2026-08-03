import { jest } from "@jest/globals";

// Mock the models BEFORE importing the service
jest.unstable_mockModule("../models/transcriptModel.js", () => ({
  default: {
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

const { default: clipExtractionService } =
  await import("../services/clipExtractionService.js");
const { default: Transcript } = await import("../models/transcriptModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");

describe("Clip Extraction Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Boundary Validation", () => {
    it("should throw error if startTime >= endTime", async () => {
      await expect(
        clipExtractionService.extractSegments("dummyId", 100, 50),
      ).rejects.toThrow("Start time must be less than end time.");

      await expect(
        clipExtractionService.extractSegments("dummyId", 100, 100),
      ).rejects.toThrow("Start time must be less than end time.");
    });

    it("should throw error if startTime < 0", async () => {
      await expect(
        clipExtractionService.extractSegments("dummyId", -10, 50),
      ).rejects.toThrow("Start time cannot be negative.");
    });
  });

  describe("Transcript Extraction", () => {
    it("should extract segments that overlap with the time boundary", async () => {
      Meeting.findById.mockResolvedValue({ _id: "meet-1" });
      Transcript.findOne.mockResolvedValue({
        meeting: "meet-1",
        segments: [
          { text: "Hello", speaker: "A", startTime: 0, endTime: 10 },
          { text: "World", speaker: "B", startTime: 10, endTime: 20 },
          { text: "This is", speaker: "A", startTime: 20, endTime: 30 },
          { text: "A test", speaker: "C", startTime: 30, endTime: 40 },
        ],
      });

      const segments = await clipExtractionService.extractSegments(
        "meet-1",
        15,
        25,
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe("World");
      expect(segments[1].text).toBe("This is");
    });

    it("should extract segments fully contained within the boundary", async () => {
      Meeting.findById.mockResolvedValue({ _id: "meet-1" });
      Transcript.findOne.mockResolvedValue({
        meeting: "meet-1",
        segments: [
          { text: "Hello", speaker: "A", startTime: 0, endTime: 10 },
          { text: "World", speaker: "B", startTime: 10, endTime: 20 },
          { text: "This is", speaker: "A", startTime: 20, endTime: 30 },
          { text: "A test", speaker: "C", startTime: 30, endTime: 40 },
        ],
      });

      const segments = await clipExtractionService.extractSegments(
        "meet-1",
        5,
        35,
      );

      expect(segments).toHaveLength(4);
    });

    it("should handle no overlapping segments", async () => {
      Meeting.findById.mockResolvedValue({ _id: "meet-1" });
      Transcript.findOne.mockResolvedValue({
        meeting: "meet-1",
        segments: [
          { text: "Hello", speaker: "A", startTime: 0, endTime: 10 },
          { text: "World", speaker: "B", startTime: 10, endTime: 20 },
        ],
      });

      const segments = await clipExtractionService.extractSegments(
        "meet-1",
        30,
        40,
      );

      expect(segments).toHaveLength(0);
    });
  });
});
