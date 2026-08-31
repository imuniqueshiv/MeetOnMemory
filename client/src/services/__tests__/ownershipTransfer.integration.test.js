import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import transferApi from "../transferApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("Ownership Transfer Client Service Integration Tests (#2666)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contract Assertions", () => {
    it("should call GET /ownership-transfers/inbox when fetching transfer inbox", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "Fetched transfer inbox",
          data: { transfers: [] },
        },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      const res = await transferApi.getTransferInbox();

      expect(apiClient.get).toHaveBeenCalledWith("/ownership-transfers/inbox");
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /meetings/:meetingId/transfers with targetUserId when initiating transfer", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "Transfer request initiated successfully",
          data: { transfer: { _id: "t-100" } },
        },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const res = await transferApi.initiateTransfer("m-100", "u-200");

      expect(apiClient.post).toHaveBeenCalledWith("/meetings/m-100/transfers", {
        targetUserId: "u-200",
      });
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /ownership-transfers/:transferId/accept when accepting transfer", async () => {
      const mockResponse = {
        data: { success: true, message: "Transfer accepted successfully" },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const res = await transferApi.acceptTransfer("t-100");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/ownership-transfers/t-100/accept",
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /ownership-transfers/:transferId/reject when rejecting transfer", async () => {
      const mockResponse = {
        data: { success: true, message: "Transfer rejected successfully" },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const res = await transferApi.rejectTransfer("t-100");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/ownership-transfers/t-100/reject",
      );
      expect(res).toEqual(mockResponse);
    });
  });

  describe("Negative Error Handling Contracts", () => {
    it("handles 401 unauthenticated response on inbox fetch", async () => {
      const authError = new Error("Session expired. Please log in again.");
      authError.response = { status: 401, data: { message: "Unauthorized" } };
      apiClient.get.mockRejectedValueOnce(authError);

      await expect(transferApi.getTransferInbox()).rejects.toThrow(
        "Session expired",
      );
    });

    it("handles 404 transfer not found error on accept", async () => {
      const notFoundError = new Error("The requested resource was not found.");
      notFoundError.response = {
        status: 404,
        data: { error: "Transfer request not found or not pending" },
      };
      apiClient.post.mockRejectedValueOnce(notFoundError);

      await expect(
        transferApi.acceptTransfer("nonexistent-id"),
      ).rejects.toThrow("resource was not found");
    });

    it("handles 400 validation error when initiating transfer to self", async () => {
      const validationError = new Error(
        "Cannot transfer ownership to yourself",
      );
      validationError.response = {
        status: 400,
        data: { error: "Cannot transfer ownership to yourself" },
      };
      apiClient.post.mockRejectedValueOnce(validationError);

      await expect(
        transferApi.initiateTransfer("m-100", "self-id"),
      ).rejects.toThrow("Cannot transfer ownership to yourself");
    });
  });
});
