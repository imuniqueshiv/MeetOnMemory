import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { indexMeeting } from "../utils/embeddingUtils.js";
import { indexTranscriptChunks } from "../utils/transcriptEmbeddingUtils.js";

// Capture upsert parameters
const mockUpsert = vi.fn();

vi.mock("../utils/embeddingUtils.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    initVectorStore: vi.fn().mockResolvedValue({
      upsert: mockUpsert,
    }),
    embedText: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
  };
});

describe("Vector Metadata Minimization & Sensitive Fields Removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures indexMeeting minimizes stored metadata and removes sensitive fields", async () => {
    const mockMeeting = {
      _id: new mongoose.Types.ObjectId("60d5ec4b1234567890123456"),
      title: "Confidential Project X Plan",
      summary: "This meeting is highly classified.",
      transcript: "We will build a secret feature that launches next month.",
      organization: new mongoose.Types.ObjectId("60d5ec4b1234567890123457"),
      createdAt: new Date(),
    };

    await indexMeeting(mockMeeting);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertedVectors = mockUpsert.mock.calls[0][0];
    expect(upsertedVectors.length).toBeGreaterThan(0);

    const firstVectorMetadata = upsertedVectors[0].metadata;

    // Check allowed fields are present
    expect(firstVectorMetadata.meetingId).toBe(mockMeeting._id.toString());
    expect(firstVectorMetadata.chunkIndex).toBe(0);
    expect(firstVectorMetadata.organization).toBe(
      mockMeeting.organization.toString(),
    );
    expect(firstVectorMetadata.text).toBeDefined();

    // Check sensitive or redundant fields are excluded
    expect(firstVectorMetadata.title).toBeUndefined();
    expect(firstVectorMetadata.summary).toBeUndefined();
    expect(firstVectorMetadata.transcript).toBeUndefined();
    expect(firstVectorMetadata.createdAt).toBeUndefined();
  });

  it("ensures indexTranscriptChunks minimizes stored metadata and removes sensitive fields", async () => {
    const mockMeeting = {
      _id: new mongoose.Types.ObjectId("60d5ec4b1234567890123456"),
      title: "Sensitive Board Meeting",
      date: new Date(),
      organization: new mongoose.Types.ObjectId("60d5ec4b1234567890123457"),
    };

    const mockTranscript = {
      _id: new mongoose.Types.ObjectId("60d5ec4b1234567890123458"),
      segments: [
        {
          speaker: "CEO John Doe",
          startTime: 0.5,
          endTime: 4.2,
          text: "Let's discuss acquisitions.",
        },
      ],
      createdAt: new Date(),
    };

    await indexTranscriptChunks(mockTranscript, mockMeeting);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertedVectors = mockUpsert.mock.calls[0][0];
    expect(upsertedVectors.length).toBeGreaterThan(0);

    const firstVectorMetadata = upsertedVectors[0].metadata;

    // Check allowed fields are present
    expect(firstVectorMetadata.meetingId).toBe(mockMeeting._id.toString());
    expect(firstVectorMetadata.transcriptId).toBe(
      mockTranscript._id.toString(),
    );
    expect(firstVectorMetadata.chunkIndex).toBe(0);
    expect(firstVectorMetadata.chunkType).toBe("transcript");
    expect(firstVectorMetadata.text).toBe("Let's discuss acquisitions.");
    expect(firstVectorMetadata.organization).toBe(
      mockMeeting.organization.toString(),
    );

    // Check sensitive or redundant fields are excluded
    expect(firstVectorMetadata.speaker).toBeUndefined();
    expect(firstVectorMetadata.startTime).toBeUndefined();
    expect(firstVectorMetadata.endTime).toBeUndefined();
    expect(firstVectorMetadata.title).toBeUndefined();
    expect(firstVectorMetadata.meetingDate).toBeUndefined();
    expect(firstVectorMetadata.createdAt).toBeUndefined();
  });
});
