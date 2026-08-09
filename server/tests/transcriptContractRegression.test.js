import { jest } from "@jest/globals";
import mongoose from "mongoose";

/**
 * Regression for Issue #679:
 * Recording/transcription layers must share one contract:
 * - schema field: meeting (not meetingId)
 * - status: recording|processing|completed|failed (+ legacy active)
 * - routes under /api/meetings/:meetingId/... and /api/search/voice
 */

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/transcriptModel.js", () => {
  const ctor = jest.fn(function TranscriptMock(doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
    this._id = new mongoose.Types.ObjectId();
  });
  ctor.findOne = jest.fn();
  ctor.findById = jest.fn();
  return { default: ctor };
});

jest.unstable_mockModule("../services/TranscriptionService.js", () => ({
  transcribeFileWithSegments: jest.fn(),
}));

jest.unstable_mockModule("../utils/embeddingUtils.js", () => ({
  indexTranscript: jest.fn(),
  searchVectorStore: jest.fn(),
  indexMeeting: jest.fn(),
}));

jest.unstable_mockModule("../utils/transcriptEmbeddingUtils.js", () => ({
  indexTranscriptChunks: jest.fn(),
}));

jest.unstable_mockModule("../services/queueService.js", () => ({
  sentimentAnalysisQueue: { isActive: false, add: jest.fn() },
}));

jest.unstable_mockModule("openai", () => ({
  default: class OpenAI {
    constructor() {
      this.audio = { transcriptions: { create: jest.fn() } };
    }
  },
}));

const Meeting = (await import("../models/meetingModel.js")).default;
const Transcript = (await import("../models/transcriptModel.js")).default;
const { startRecording, getTranscript, stopRecording } =
  await import("../controllers/transcriptController.js");
const transcriptModelSource = await import("fs").then((fs) =>
  fs.readFileSync(
    new URL("../models/transcriptModel.js", import.meta.url),
    "utf8",
  ),
);
const meetingRoutesSource = await import("fs").then((fs) =>
  fs.readFileSync(
    new URL("../routes/meetingRoutes.js", import.meta.url),
    "utf8",
  ),
);
const searchRoutesSource = await import("fs").then((fs) =>
  fs.readFileSync(
    new URL("../routes/searchRoutes.js", import.meta.url),
    "utf8",
  ),
);
const transcriptRoutesSource = await import("fs").then((fs) =>
  fs.readFileSync(
    new URL("../routes/transcriptRoutes.js", import.meta.url),
    "utf8",
  ),
);
const socketSource = await import("fs").then((fs) =>
  fs.readFileSync(
    new URL("../socket/transcriptSocket.js", import.meta.url),
    "utf8",
  ),
);

describe("Transcript recording contract (#679)", () => {
  const meetingId = new mongoose.Types.ObjectId().toString();
  const orgId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("model uses meeting field and includes recording/processing statuses", () => {
    expect(transcriptModelSource).toMatch(/meeting:\s*\{/);
    expect(transcriptModelSource).toMatch(/"recording"/);
    expect(transcriptModelSource).toMatch(/"processing"/);
    expect(transcriptModelSource).not.toMatch(/meetingId:\s*\{/);
  });

  it("recording routes are mounted under /api/meetings/:meetingId", () => {
    expect(meetingRoutesSource).toContain("/:meetingId/recording/start");
    expect(meetingRoutesSource).toContain("/:meetingId/recording/stop");
    expect(meetingRoutesSource).toContain("/:meetingId/transcript");
    expect(meetingRoutesSource).toContain("/:meetingId/transcript/chunk");
    expect(searchRoutesSource).toMatch(/["'`]\/voice["'`]/);
    expect(transcriptRoutesSource).not.toContain(
      "/meetings/:meetingId/recording",
    );
    expect(transcriptRoutesSource).not.toMatch(
      /router\.(get|post)\(\s*["'`]\/search\/voice/,
    );
  });

  it("socket looks up transcripts by meeting (not meetingId)", () => {
    expect(socketSource).toContain(
      "Transcript.findOne({ meeting: meetingId })",
    );
    expect(socketSource).not.toContain("Transcript.findOne({ meetingId })");
  });

  it("startRecording creates a transcript with meeting + recording status", async () => {
    Meeting.findById.mockResolvedValue({
      _id: meetingId,
      organization: orgId,
      uploadedBy: userId,
    });
    Transcript.findOne.mockResolvedValue(null);

    const req = {
      params: { meetingId },
      user: { id: userId, organization: orgId },
    };
    const res = mockRes();

    await startRecording(req, res);

    expect(Transcript.findOne).toHaveBeenCalledWith({
      meeting: meetingId,
      status: { $in: ["recording", "active"] },
    });
    expect(Transcript).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting: meetingId,
        organizationId: orgId,
        status: "recording",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        roomId: `meeting:${meetingId}:transcript`,
      }),
    );
  });

  it("getTranscript queries by meeting field", async () => {
    Meeting.findById.mockResolvedValue({
      _id: meetingId,
      organization: orgId,
      uploadedBy: userId,
    });
    const transcriptDoc = {
      _id: new mongoose.Types.ObjectId(),
      meeting: meetingId,
      status: "completed",
      fullText: "hello",
    };
    Transcript.findOne.mockResolvedValue(transcriptDoc);

    const req = {
      params: { meetingId },
      user: { id: userId, organization: orgId },
    };
    const res = mockRes();

    await getTranscript(req, res);

    expect(Transcript.findOne).toHaveBeenCalledWith({ meeting: meetingId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      transcript: transcriptDoc,
    });
  });

  it("stopRecording finds in-progress transcript by meeting and marks processing", async () => {
    Meeting.findById.mockResolvedValue({
      _id: meetingId,
      organization: orgId,
      uploadedBy: userId,
    });

    const transcriptDoc = {
      _id: new mongoose.Types.ObjectId(),
      meeting: meetingId,
      status: "recording",
      recordingTimestamps: {},
      save: jest.fn().mockResolvedValue(true),
    };
    Transcript.findOne.mockResolvedValue(transcriptDoc);
    // Avoid background processTranscription console noise in this unit test
    Transcript.findById.mockResolvedValue(null);

    const req = {
      params: { meetingId },
      user: { id: userId, organization: orgId },
    };
    const res = mockRes();

    await stopRecording(req, res);

    expect(Transcript.findOne).toHaveBeenCalledWith({
      meeting: meetingId,
      status: { $in: ["recording", "active"] },
    });
    expect(transcriptDoc.status).toBe("processing");
    expect(transcriptDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
