import { jest } from "@jest/globals";

// Mock dependencies before importing
jest.unstable_mockModule("../models/transcriptAnnotationModel.js", () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    prototype: {
      save: jest.fn(),
    },
  },
}));

jest.unstable_mockModule("../models/transcriptModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/eventBus.js", () => ({
  default: {
    emit: jest.fn(),
    on: jest.fn(),
  },
}));

const { transcriptAnnotationService } =
  await import("../services/transcriptAnnotationService.js");
const Transcript = (await import("../models/transcriptModel.js")).default;

describe("Transcript Annotation Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should block creation if startTime > endTime", async () => {
    await expect(
      transcriptAnnotationService.createAnnotation({
        startTime: 10,
        endTime: 5,
        transcript: "transcriptId",
        meeting: "meetingId",
      }),
    ).rejects.toThrow("startTime must be less than or equal to endTime");
  });

  it("should validate meeting access", async () => {
    Transcript.findById.mockResolvedValue({
      _id: "transcriptId",
      meeting: { toString: () => "anotherMeetingId" },
    });

    await expect(
      transcriptAnnotationService.createAnnotation({
        startTime: 5,
        endTime: 10,
        transcript: "transcriptId",
        meeting: { toString: () => "meetingId" },
      }),
    ).rejects.toThrow("Transcript does not belong to this meeting");
  });
});
