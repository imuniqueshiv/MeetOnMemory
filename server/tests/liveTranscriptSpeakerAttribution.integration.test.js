import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockSave = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockFindById(...args),
  },
}));

jest.unstable_mockModule("../models/organizationModel.js", () => ({
  default: {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
  },
}));

const mockSpeakerMappingFindOne = jest.fn();
jest.unstable_mockModule("../models/speakerMappingModel.js", () => ({
  default: {
    findOne: (...args) => mockSpeakerMappingFindOne(...args),
  },
}));

let _currentTranscriptDoc = null;

jest.unstable_mockModule("../models/transcriptModel.js", () => {
  class MockTranscript {
    constructor(data) {
      this._id = new mongoose.Types.ObjectId().toString();
      this.meeting = data.meeting;
      this.organizationId = data.organizationId;
      this.status = data.status || "active";
      this.segments = data.segments || [];
      this.fullText = data.fullText || "";
      this.duration = data.duration || 0;
      _currentTranscriptDoc = this;
    }
    save() {
      mockSave();
      return Promise.resolve(this);
    }
    static findOne(...args) {
      return mockFindOne(...args);
    }
  }
  return { default: MockTranscript };
});

jest.unstable_mockModule("openai", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({
            text: "Hello team, let us review the project milestones.",
          }),
        },
      },
    })),
  };
});

jest.unstable_mockModule("../models/RecordingSession.js", () => ({
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      chunkCount: 0,
      duration: 0,
      save: jest.fn().mockResolvedValue(true),
    }),
  },
}));

const { uploadTranscriptChunk, persistCaptionSegments } =
  await import("../controllers/transcriptController.js");

describe("Live Transcript Chunk Speaker Attribution Integration Tests (#2665)", () => {
  let app;
  let unassignedUserApp;
  const mockMeetingId = new mongoose.Types.ObjectId().toString();
  const mockOrgId = new mongoose.Types.ObjectId().toString();
  const mockUser = {
    id: new mongoose.Types.ObjectId().toString(),
    name: "Alice Participant",
    email: "alice@example.com",
    organization: mockOrgId,
  };

  const mockMeeting = {
    _id: mockMeetingId,
    title: "Live Product Sync",
    organization: mockOrgId,
    uploadedBy: mockUser.id,
    transcript: "",
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    _currentTranscriptDoc = null;

    mockFindById.mockResolvedValue(mockMeeting);
    mockSpeakerMappingFindOne.mockResolvedValue(null);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });

    app.post(
      "/api/meetings/:meetingId/transcript/chunk",
      (req, res, next) => {
        req.file = { buffer: Buffer.from("dummy-audio-chunk") };
        next();
      },
      uploadTranscriptChunk,
    );
    app.post(
      "/api/meetings/:meetingId/transcript/captions",
      persistCaptionSegments,
    );

    unassignedUserApp = express();
    unassignedUserApp.use(express.json());
    unassignedUserApp.use((req, res, next) => {
      req.user = { _id: "user-no-name", organization: mockOrgId };
      next();
    });
    unassignedUserApp.post(
      "/api/meetings/:meetingId/transcript/captions",
      persistCaptionSegments,
    );
  });

  it("Test 1: assigns speaker from explicit payload metadata (speakerName / speaker)", async () => {
    mockFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/meetings/${mockMeetingId}/transcript/chunk`)
      .send({ speaker: "Charlie Product Owner" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.speaker).toBe("Charlie Product Owner");
    expect(res.body.segment.speaker).toBe("Charlie Product Owner");
  });

  it("Test 2: maps speaker label using SpeakerMapping database records for the meeting", async () => {
    mockFindOne.mockResolvedValue(null);

    const mappedDoc = {
      meeting: mockMeetingId,
      originalLabel: "spk_1",
      mappedName: "Dr. Evelyn Vance",
    };

    mockSpeakerMappingFindOne.mockImplementation(
      ({ meeting: _meeting, $or }) => {
        const isMatch = $or?.some((cond) => cond.originalLabel === "spk_1");
        if (isMatch) {
          return Promise.resolve(mappedDoc);
        }
        return Promise.resolve(null);
      },
    );

    const res = await request(app)
      .post(`/api/meetings/${mockMeetingId}/transcript/captions`)
      .send({
        segments: [
          {
            text: "Welcome to the research briefing.",
            speakerId: "spk_1",
            startTime: 0,
            endTime: 4,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.segments[0].speaker).toBe("Dr. Evelyn Vance");
    expect(res.body.segments[0].speaker).not.toBe("Speaker");
  });

  it("Test 3: multi-speaker sequence attributes segments correctly without hardcoding 'Speaker'", async () => {
    mockFindOne.mockResolvedValue(null);

    mockSpeakerMappingFindOne.mockImplementation(({ $or }) => {
      const matchSpk1 = $or?.some((c) => c.originalLabel === "spk_1");
      const matchSpk2 = $or?.some((c) => c.originalLabel === "spk_2");
      if (matchSpk1) {
        return Promise.resolve({ originalLabel: "spk_1", mappedName: "Alice" });
      }
      if (matchSpk2) {
        return Promise.resolve({ originalLabel: "spk_2", mappedName: "Bob" });
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post(`/api/meetings/${mockMeetingId}/transcript/captions`)
      .send({
        segments: [
          {
            text: "First point by Alice",
            speakerId: "spk_1",
            startTime: 0,
            endTime: 3,
          },
          {
            text: "Second point by Bob",
            speakerId: "spk_2",
            startTime: 3,
            endTime: 6,
          },
          {
            text: "Follow-up by Alice",
            speakerId: "spk_1",
            startTime: 6,
            endTime: 9,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.segments[0].speaker).toBe("Alice");
    expect(res.body.segments[1].speaker).toBe("Bob");
    expect(res.body.segments[2].speaker).toBe("Alice");
  });

  it("Test 4: falls back to authenticated user name when no speaker metadata payload is sent", async () => {
    mockFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/meetings/${mockMeetingId}/transcript/chunk`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.speaker).toBe("Alice Participant");
    expect(res.body.segment.speaker).toBe("Alice Participant");
  });

  it("Test 5: falls back to 'Unknown' when unmapped and user details are blank (never 'Speaker')", async () => {
    mockFindOne.mockResolvedValue(null);
    mockSpeakerMappingFindOne.mockResolvedValue(null);

    const res = await request(unassignedUserApp)
      .post(`/api/meetings/${mockMeetingId}/transcript/captions`)
      .send({
        segments: [
          {
            text: "Unattributed background audio caption segment.",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.segments[0].speaker).toBe("Unknown");
    expect(res.body.segments[0].speaker).not.toBe("Speaker");
  });

  it("Test 6: preserves segment text, timestamps, duration, and fullText integrity", async () => {
    mockFindOne.mockResolvedValue(null);
    mockSpeakerMappingFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/meetings/${mockMeetingId}/transcript/captions`)
      .send({
        segments: [
          {
            text: "Preserved exact text content.",
            speaker: "David Lead",
            startTime: 10.5,
            endTime: 15.5,
            confidence: 0.98,
          },
        ],
      });

    expect(res.status).toBe(200);
    const seg = res.body.segments[0];
    expect(seg.text).toBe("Preserved exact text content.");
    expect(seg.speaker).toBe("David Lead");
    expect(seg.startTime).toBe(10.5);
    expect(seg.endTime).toBe(15.5);
    expect(seg.confidence).toBe(0.98);
    expect(res.body.fullText).toBe("Preserved exact text content.");
  });
});
