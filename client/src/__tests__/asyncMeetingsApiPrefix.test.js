import { beforeEach, describe, expect, it, vi } from "vitest";
import asyncMeetingApi, {
  getAsyncMeetings,
  createAsyncMeeting,
  submitAsyncUpdate,
  getAsyncMeetingById,
} from "../services/asyncMeetingApi";
import apiClient from "../services/apiClient";

vi.mock("../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("Async Meetings API Prefix Suite (#2621)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API endpoint paths verification", () => {
    it("should call getAsyncMeetings with /api/async-meetings", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      await getAsyncMeetings({ status: "pending" });

      expect(apiClient.get).toHaveBeenCalledWith("/api/async-meetings", {
        params: { status: "pending" },
      });
    });

    it("should call createAsyncMeeting with /api/async-meetings", async () => {
      const payload = { title: "Async Standup" };
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, data: {} },
      });

      await createAsyncMeeting(payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/async-meetings",
        payload,
      );
    });

    it("should call submitAsyncUpdate with /api/async-meetings/:id/submit", async () => {
      const answers = [{ question: "Progress?", answer: "Done" }];
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, data: {} },
      });

      await submitAsyncUpdate("m-123", answers);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/async-meetings/m-123/submit",
        { answers },
      );
    });

    it("should call getAsyncMeetingById with /api/async-meetings/:id", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: {} },
      });

      await getAsyncMeetingById("m-123");

      expect(apiClient.get).toHaveBeenCalledWith("/api/async-meetings/m-123");
    });
  });

  describe("Default export consistency", () => {
    it("should provide consistent methods on asyncMeetingApi default object", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      await asyncMeetingApi.getAsyncMeetings();

      expect(apiClient.get).toHaveBeenCalledWith("/api/async-meetings", {
        params: undefined,
      });
    });
  });
});
