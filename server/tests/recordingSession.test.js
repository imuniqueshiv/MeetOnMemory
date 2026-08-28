import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import RecordingSession from "../models/RecordingSession.js";
import {
  startRecordingSession,
  recordChunk,
  updateSessionStatus,
  getRecordingSessionMetrics,
  resolveStuckSession,
} from "../controllers/recordingSessionController.js";
import Meeting from "../models/meetingModel.js";

describe("RecordingSession Controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockReq = {
      user: { _id: "user123", id: "user123", organization: "org123" },
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("startRecordingSession", () => {
    it("should return 400 if meetingId is missing", async () => {
      mockReq.body = {};
      await startRecordingSession(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "meetingId is required",
        }),
      );
    });

    it("should return 404 if meeting is not found", async () => {
      mockReq.body = { meetingId: "meet123" };
      jest.spyOn(Meeting, "findById").mockResolvedValue(null);

      await startRecordingSession(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should create a new session if none is IN_PROGRESS", async () => {
      mockReq.body = { meetingId: "meet123", metadata: { browser: "Chrome" } };
      jest
        .spyOn(Meeting, "findById")
        .mockResolvedValue({ _id: "meet123", organization: "org123" });
      jest.spyOn(RecordingSession, "findOne").mockResolvedValue(null);
      jest.spyOn(RecordingSession, "create").mockResolvedValue({
        _id: "sess123",
        status: "IN_PROGRESS",
        meeting: "meet123",
      });

      await startRecordingSession(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          session: expect.objectContaining({ _id: "sess123" }),
        }),
      );
    });
  });

  describe("recordChunk", () => {
    it("should increment duration, chunkCount, and update lastHeartbeatAt", async () => {
      mockReq.params = { sessionId: "sess123" };
      mockReq.body = { chunkDuration: 5, success: true };

      const mockSession = {
        _id: "sess123",
        duration: 10,
        chunkCount: 2,
        retryCount: 0,
        lastHeartbeatAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RecordingSession, "findById").mockResolvedValue(mockSession);

      await recordChunk(mockReq, mockRes);
      expect(mockSession.duration).toBe(15);
      expect(mockSession.chunkCount).toBe(3);
      expect(mockSession.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should track retry and error details when retry/failure occurs", async () => {
      mockReq.params = { sessionId: "sess123" };
      mockReq.body = {
        isRetry: true,
        success: false,
        errorReason: "Whisper connection timeout",
        chunkIndex: 4,
      };

      const mockSession = {
        _id: "sess123",
        duration: 10,
        chunkCount: 3,
        retryCount: 0,
        failureReason: null,
        failureHistory: [],
        lastHeartbeatAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RecordingSession, "findById").mockResolvedValue(mockSession);

      await recordChunk(mockReq, mockRes);
      expect(mockSession.retryCount).toBe(1);
      expect(mockSession.failureReason).toBe("Whisper connection timeout");
      expect(mockSession.failureHistory.length).toBe(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("updateSessionStatus", () => {
    it("should update session status and endedAt for COMPLETED status", async () => {
      mockReq.params = { sessionId: "sess123" };
      mockReq.body = { status: "COMPLETED", duration: 60 };

      const mockSession = {
        _id: "sess123",
        status: "IN_PROGRESS",
        duration: 0,
        failureHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RecordingSession, "findById").mockResolvedValue(mockSession);

      await updateSessionStatus(mockReq, mockRes);
      expect(mockSession.status).toBe("COMPLETED");
      expect(mockSession.duration).toBe(60);
      expect(mockSession.endedAt).toBeDefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getRecordingSessionMetrics", () => {
    it("should compute aggregate metrics including stuck session detection", async () => {
      const mockSessions = [
        {
          _id: "s1",
          status: "COMPLETED",
          duration: 100,
          chunkCount: 20,
          retryCount: 1,
          failureReason: null,
          failureHistory: [],
        },
        {
          _id: "s2",
          status: "FAILED",
          duration: 30,
          chunkCount: 5,
          retryCount: 3,
          failureReason: "Network drop",
          failureHistory: [{ reason: "Network drop" }],
        },
        {
          _id: "s3",
          status: "IN_PROGRESS",
          duration: 15,
          chunkCount: 3,
          retryCount: 0,
          lastHeartbeatAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      ];

      const chainMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockSessions),
      };
      jest.spyOn(RecordingSession, "find").mockReturnValue(chainMock);

      await getRecordingSessionMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          metrics: expect.objectContaining({
            totalSessions: 3,
            totalDuration: 145,
            totalChunkCount: 28,
            totalRetryCount: 4,
            stuckCount: 1,
          }),
          stuckSessions: expect.arrayContaining([
            expect.objectContaining({ _id: "s3" }),
          ]),
        }),
      );
    });
  });

  describe("resolveStuckSession", () => {
    it("should resolve stuck session to FAILED", async () => {
      mockReq.params = { sessionId: "sessStuck" };
      mockReq.body = {
        targetStatus: "FAILED",
        reason: "Admin terminated stuck session",
      };

      const mockSession = {
        _id: "sessStuck",
        status: "IN_PROGRESS",
        chunkCount: 10,
        failureHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RecordingSession, "findById").mockResolvedValue(mockSession);

      await resolveStuckSession(mockReq, mockRes);
      expect(mockSession.status).toBe("FAILED");
      expect(mockSession.failureReason).toBe("Admin terminated stuck session");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
