import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi as jest,
} from "vitest";

jest.mock("../models/transcriptModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../utils/responseHandler.js", () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

const { updateSpeakers } =
  await import("../controllers/transcriptController.js");
const Transcript = (await import("../models/transcriptModel.js")).default;
const { sendSuccess, sendError } = await import("../utils/responseHandler.js");

describe("transcriptController - updateSpeakers", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: { id: "650c1f1e1c9d440000a1b1c1" },
      body: { oldSpeaker: "Speaker 1", newSpeaker: "John Doe" },
      user: { _id: "user123", role: "user", organization: "org123" },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should return 400 if oldSpeaker or newSpeaker is missing", async () => {
    req.body = { oldSpeaker: "Speaker 1" }; // missing newSpeaker

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      "Old speaker and new speaker are required",
    );
  });

  it("should return 404 if transcript is not found", async () => {
    const mockQuery = {
      populate: jest.fn().mockResolvedValue(null),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(Transcript.findById).toHaveBeenCalledWith(
      "650c1f1e1c9d440000a1b1c1",
    );
    expect(sendError).toHaveBeenCalledWith(res, 404, "Transcript not found");
  });

  it("should return 403 if user lacks permissions", async () => {
    const mockTranscript = {
      _id: "650c1f1e1c9d440000a1b1c1",
      meeting: {
        _id: "meeting123",
        uploadedBy: "otherUser",
        organization: "org456", // different org
      },
    };
    const mockQuery = {
      populate: jest.fn().mockResolvedValue(mockTranscript),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      403,
      "Forbidden: You don't have permission to edit this transcript",
    );
  });

  it("should bulk update speakers if no segmentIndex is provided", async () => {
    const mockTranscript = {
      _id: "650c1f1e1c9d440000a1b1c1",
      meeting: {
        _id: "meeting123",
        uploadedBy: "user123", // user is owner
      },
      segments: [
        { speaker: "Speaker 1", text: "Hello" },
        { speaker: "Speaker 2", text: "Hi" },
        { speaker: "Speaker 1", text: "How are you?" },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    const mockQuery = {
      populate: jest.fn().mockResolvedValue(mockTranscript),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(mockTranscript.segments[0].speaker).toBe("John Doe");
    expect(mockTranscript.segments[1].speaker).toBe("Speaker 2"); // unchanged
    expect(mockTranscript.segments[2].speaker).toBe("John Doe");
    expect(mockTranscript.save).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "Successfully updated 2 segment(s)",
    );
  });

  it("should update a specific segment if segmentIndex is provided", async () => {
    req.body.segmentIndex = 2; // Only update the 3rd segment

    const mockTranscript = {
      _id: "650c1f1e1c9d440000a1b1c1",
      meeting: {
        _id: "meeting123",
        uploadedBy: "user123",
      },
      segments: [
        { speaker: "Speaker 1", text: "Hello" },
        { speaker: "Speaker 2", text: "Hi" },
        { speaker: "Speaker 1", text: "How are you?" },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    const mockQuery = {
      populate: jest.fn().mockResolvedValue(mockTranscript),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(mockTranscript.segments[0].speaker).toBe("Speaker 1"); // unchanged
    expect(mockTranscript.segments[1].speaker).toBe("Speaker 2"); // unchanged
    expect(mockTranscript.segments[2].speaker).toBe("John Doe"); // updated
    expect(mockTranscript.save).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "Successfully updated 1 segment(s)",
    );
  });

  it("should return success message if no segments were updated", async () => {
    req.body.oldSpeaker = "Nonexistent Speaker"; // won't match any

    const mockTranscript = {
      _id: "650c1f1e1c9d440000a1b1c1",
      meeting: {
        _id: "meeting123",
        uploadedBy: "user123",
      },
      segments: [
        { speaker: "Speaker 1", text: "Hello" },
        { speaker: "Speaker 2", text: "Hi" },
      ],
      save: jest.fn(),
    };
    const mockQuery = {
      populate: jest.fn().mockResolvedValue(mockTranscript),
    };
    Transcript.findById.mockReturnValue(mockQuery);

    await updateSpeakers(req, res);

    expect(mockTranscript.save).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockTranscript,
      "No segments found matching the specified speaker",
    );
  });

  it("should return 500 on server error", async () => {
    Transcript.findById.mockImplementation(() => {
      throw new Error("Database error");
    });

    await updateSpeakers(req, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      500,
      "Failed to update speakers",
    );
  });
});
