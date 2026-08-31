import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../services/apiClient";
import transferApi from "../services/transferApi";

vi.mock("../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("transferApi Client Endpoint Prefix Suite (#2617)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initiateTransfer", () => {
    it("should format API endpoint path with /api prefix when initiating transfer", async () => {
      const meetingId = "meeting-123-abc";
      const targetUserId = "user-456-def";
      apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      const response = await transferApi.initiateTransfer(
        meetingId,
        targetUserId,
      );

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/transfers`,
        { targetUserId },
      );
      expect(response).toEqual({ data: { success: true } });
    });

    it("should handle error when initiating transfer fails", async () => {
      const meetingId = "meeting-999";
      const targetUserId = "user-888";
      const errorResponse = {
        response: { data: { message: "User not in organization" } },
      };
      apiClient.post.mockRejectedValueOnce(errorResponse);

      await expect(
        transferApi.initiateTransfer(meetingId, targetUserId),
      ).rejects.toEqual(errorResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/transfers`,
        { targetUserId },
      );
    });
  });

  describe("getTransferInbox", () => {
    it("should format API endpoint path with /api prefix when fetching transfer inbox", async () => {
      const mockTransfers = [
        {
          _id: "t1",
          meeting: { title: "Sprint Planning" },
          fromUser: { name: "Alice" },
        },
      ];
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, transfers: mockTransfers },
      });

      const response = await transferApi.getTransferInbox();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/ownership-transfers/inbox",
      );
      expect(response.data.transfers).toEqual(mockTransfers);
    });

    it("should propagate network errors from transfer inbox endpoint", async () => {
      apiClient.get.mockRejectedValueOnce(new Error("Network Error"));

      await expect(transferApi.getTransferInbox()).rejects.toThrow(
        "Network Error",
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/ownership-transfers/inbox",
      );
    });
  });

  describe("acceptTransfer", () => {
    it("should call /api/ownership-transfers/:transferId/accept", async () => {
      const transferId = "transfer-789";
      apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      const response = await transferApi.acceptTransfer(transferId);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/ownership-transfers/${transferId}/accept`,
      );
      expect(response).toEqual({ data: { success: true } });
    });

    it("should reject with server error message when transfer accept fails", async () => {
      const transferId = "transfer-expired";
      apiClient.post.mockRejectedValueOnce({
        response: { data: { message: "Transfer request expired" } },
      });

      await expect(transferApi.acceptTransfer(transferId)).rejects.toEqual({
        response: { data: { message: "Transfer request expired" } },
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/ownership-transfers/${transferId}/accept`,
      );
    });
  });

  describe("rejectTransfer", () => {
    it("should call /api/ownership-transfers/:transferId/reject", async () => {
      const transferId = "transfer-456";
      apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      const response = await transferApi.rejectTransfer(transferId);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/ownership-transfers/${transferId}/reject`,
      );
      expect(response).toEqual({ data: { success: true } });
    });
  });
});
