import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSpeakers } from "../controllers/transcriptController.js";
import Transcript from "../models/transcriptModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

// Mock dependencies
vi.mock("../models/transcriptModel.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../utils/responseHandler.js", () => ({
  sendSuccess: vi.fn(),
  sendError: vi.fn(),
}));

describe("transcriptController - updateSpeakers", () => {
  let req;
  let res;
  let mockTranscript;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { id: "transcript123" },
      body: { oldSpeaker: "Speaker A", newSpeaker: "John Doe" },
      user: {
        _id: "user123",
        role: "owner",
        organization: "org123",
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockTranscript = {
      _id: "transcript123",
      meeting: {
        _id: "meeting123",
        uploadedBy: "user123",
        organization: "org123",
      },
      segments: [
        { speaker: "Speaker A", text: "Hello" },
        { speaker: "Speaker B", text: "Hi" },
        { speaker: "Speaker A", text: "How are you?" },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    const mockQuery = {
      populate: vi.fn().mockResolvedValue(mockTranscript),
    };
    Transcript.findById.mockReturnValue(mockQuery);
  });

  it("should return 400 if oldSpeaker or newSpeaker is missing", async () => {
    req.body.newSpeaker = "";

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      "Old speaker and new speaker are required",
    );
  });

  it("should return 404 if transcript is not found", async () => {
    const mockQuery = {
      populate: vi.fn().mockResolvedValue(null),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(res, 404, "Transcript not found");
  });

  it("should return 403 if user lacks permissions", async () => {
    req.user = {
      _id: "user999",
      role: "member",
      organization: "org999",
    };

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      403,
      "Forbidden: You don't have permission to edit this transcript",
    );
  });

  it("should bulk update speakers if no segmentIndex is provided", async () => {
    await updateSpeakers(req, res);

    expect(mockTranscript.segments[0].speaker).toBe("John Doe");
    expect(mockTranscript.segments[1].speaker).toBe("Speaker B");
    expect(mockTranscript.segments[2].speaker).toBe("John Doe");

    expect(mockTranscript.save).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "Successfully updated 2 segment(s)",
    );
  });

  it("should update a specific segment if segmentIndex is provided", async () => {
    req.body.segmentIndex = 0;

    await updateSpeakers(req, res);

    expect(mockTranscript.segments[0].speaker).toBe("John Doe");
    // Other matching segments shouldn't change
    expect(mockTranscript.segments[2].speaker).toBe("Speaker A");

    expect(mockTranscript.save).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "Successfully updated 1 segment(s)",
    );
  });

  it("should return success message if no segments were updated", async () => {
    req.body.oldSpeaker = "NonExistentSpeaker";

    await updateSpeakers(req, res);

    expect(mockTranscript.save).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "No segments found matching the specified speaker",
    );
  });

  it("should return 500 on server error", async () => {
    const mockQuery = {
      populate: vi.fn().mockRejectedValue(new Error("DB Error")),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      500,
      "Failed to update speakers",
    );
  });
});
