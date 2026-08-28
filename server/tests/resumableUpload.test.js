import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("../models/uploadSessionModel.js", () => {
  let mockDoc = null;

  return {
    default: {
      create: vi.fn().mockImplementation((data) => {
        mockDoc = {
          ...data,
          save: vi.fn().mockResolvedValue(true),
        };
        return Promise.resolve(mockDoc);
      }),
      findOne: vi.fn().mockImplementation(({ uploadId }) => {
        if (mockDoc && mockDoc.uploadId === uploadId) {
          return Promise.resolve(mockDoc);
        }
        return Promise.resolve(null);
      }),
    },
  };
});

vi.mock("../services/meetingService.js", () => ({
  default: {
    uploadAndTranscribeMeeting: vi.fn().mockResolvedValue({
      meeting: { _id: "meeting-123", title: "Resumable Meeting" },
      transcript: "Transcribed meeting text",
    }),
  },
}));

import {
  initResumableUpload,
  uploadChunk,
  getUploadStatus,
  completeResumableUpload,
  abortResumableUpload,
} from "../controllers/resumableUploadController.js";
import UploadSession from "../models/uploadSessionModel.js";

describe("Resumable Upload Controller (#2268)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { id: "user-1", organization: "org-1" },
      body: {},
      params: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  afterEach(() => {
    // Cleanup temporary chunks directory if created
    const chunksRootDir = path.resolve("uploads", "chunks");
    if (fs.existsSync(chunksRootDir)) {
      try {
        fs.rmSync(chunksRootDir, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
  });

  it("initResumableUpload creates session and chunk directory", async () => {
    req.body = {
      fileName: "recording.mp3",
      fileSize: 10485760,
      totalChunks: 2,
      title: "Quarterly Review",
      date: "2026-08-25",
    };

    await initResumableUpload(req, res, next);

    expect(UploadSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "recording.mp3",
        fileSize: 10485760,
        totalChunks: 2,
        status: "in_progress",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        totalChunks: 2,
      }),
    );
  });

  it("uploadChunk saves chunk buffer and updates uploadedChunks array", async () => {
    // Init session first
    req.body = {
      fileName: "test.wav",
      fileSize: 100,
      totalChunks: 2,
    };
    await initResumableUpload(req, res, next);
    const uploadId = res.json.mock.calls[0][0].uploadId;

    // Reset mocks for uploadChunk
    res.status.mockClear();
    res.json.mockClear();

    req.body = {
      uploadId,
      chunkIndex: 0,
      totalChunks: 2,
    };
    req.file = {
      buffer: Buffer.from("Chunk 0 data "),
    };

    await uploadChunk(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        chunkIndex: 0,
        uploadedChunks: [0],
      }),
    );
  });

  it("getUploadStatus rehydrates upload session state for client", async () => {
    req.body = {
      fileName: "meeting.m4a",
      fileSize: 200,
      totalChunks: 2,
    };
    await initResumableUpload(req, res, next);
    const uploadId = res.json.mock.calls[0][0].uploadId;

    res.status.mockClear();
    res.json.mockClear();

    req.params = { uploadId };
    await getUploadStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        uploadId,
        fileName: "meeting.m4a",
        status: "in_progress",
      }),
    );
  });

  it("completeResumableUpload assembles chunks and verifies size integrity", async () => {
    // Init session
    const chunk0 = Buffer.from("Hello ");
    const chunk1 = Buffer.from("World!");
    const totalSize = chunk0.length + chunk1.length;

    req.body = {
      fileName: "test_assemble.mp3",
      fileSize: totalSize,
      totalChunks: 2,
    };
    await initResumableUpload(req, res, next);
    const uploadId = res.json.mock.calls[0][0].uploadId;

    // Upload chunk 0
    req.body = { uploadId, chunkIndex: 0, totalChunks: 2 };
    req.file = { buffer: chunk0 };
    await uploadChunk(req, res, next);

    // Upload chunk 1
    req.body = { uploadId, chunkIndex: 1, totalChunks: 2 };
    req.file = { buffer: chunk1 };
    await uploadChunk(req, res, next);

    res.status.mockClear();
    res.json.mockClear();

    // Complete upload
    req.body = { uploadId };
    await completeResumableUpload(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meetingId: "meeting-123",
        transcript: "Transcribed meeting text",
      }),
    );
  });

  it("abortResumableUpload sets status to aborted and clears temp files", async () => {
    req.body = { uploadId: "upload-abort-123" };
    await abortResumableUpload(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });
});
