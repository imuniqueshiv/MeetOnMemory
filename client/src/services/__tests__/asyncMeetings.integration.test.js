import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import * as asyncMeetingApi from "../asyncMeetingApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("Async Meetings Client Service Integration Tests (#2666)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contract Assertions", () => {
    it("should call GET /async-meetings with query parameters when listing", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 20 },
        },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      const res = await asyncMeetingApi.getAsyncMeetings({ status: "pending" });

      expect(apiClient.get).toHaveBeenCalledWith("/async-meetings", {
        params: { status: "pending" },
      });
      expect(res).toEqual(mockResponse);
    });

    it("should call GET /async-meetings/:id when fetching single async meeting", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { _id: "async-100", title: "Project Sync" },
        },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      const res = await asyncMeetingApi.getAsyncMeetingById("async-100");

      expect(apiClient.get).toHaveBeenCalledWith("/async-meetings/async-100");
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /async-meetings/:id/submit with answers when submitting update", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { _id: "async-100", status: "completed" },
        },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const answers = [
        { question: "What did you complete?", answer: "Implemented feature X" },
      ];
      const res = await asyncMeetingApi.submitAsyncUpdate("async-100", answers);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/async-meetings/async-100/submit",
        { answers },
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /async-meetings when creating async meeting", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { _id: "async-101", title: "Weekly Standup" },
        },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const payload = {
        title: "Weekly Standup",
        template: ["Updates?"],
        deadline: "2026-09-01T00:00:00.000Z",
        participants: ["u-1"],
      };
      const res = await asyncMeetingApi.createAsyncMeeting(payload);

      expect(apiClient.post).toHaveBeenCalledWith("/async-meetings", payload);
      expect(res).toEqual(mockResponse);
    });
  });

  describe("Negative Error Handling Contracts", () => {
    it("handles 401 unauthenticated response when fetching async meetings", async () => {
      const authError = new Error("Session expired. Please log in again.");
      authError.response = { status: 401, data: { error: "Unauthorized" } };
      apiClient.get.mockRejectedValueOnce(authError);

      await expect(asyncMeetingApi.getAsyncMeetings()).rejects.toThrow(
        "Session expired",
      );
    });

    it("handles 404 async meeting not found error", async () => {
      const notFoundError = new Error("The requested resource was not found.");
      notFoundError.response = {
        status: 404,
        data: { error: "Async meeting not found" },
      };
      apiClient.get.mockRejectedValueOnce(notFoundError);

      await expect(
        asyncMeetingApi.getAsyncMeetingById("nonexistent"),
      ).rejects.toThrow("resource was not found");
    });

    it("handles 403 deadline passed submission locked error", async () => {
      const lockedError = new Error(
        "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
      );
      lockedError.response = {
        status: 403,
        data: {
          error:
            "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
        },
      };
      apiClient.post.mockRejectedValueOnce(lockedError);

      await expect(
        asyncMeetingApi.submitAsyncUpdate("async-100", [
          { question: "Q", answer: "A" },
        ]),
      ).rejects.toThrow("SUBMISSION_LOCKED");
    });

    it("handles 400 validation error on empty answers array", async () => {
      const valError = new Error("answers must be a non-empty array");
      valError.response = {
        status: 400,
        data: { error: "answers must be a non-empty array" },
      };
      apiClient.post.mockRejectedValueOnce(valError);

      await expect(
        asyncMeetingApi.submitAsyncUpdate("async-100", []),
      ).rejects.toThrow("answers must be a non-empty array");
    });
  });
});
