import { beforeEach, describe, expect, it, vi } from "vitest";
import * as minutesApprovalApi from "../services/minutesApprovalApi";
import apiClient from "../services/apiClient";

vi.mock("../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("Minutes Approval API Contract & Prefix Suite (#2618)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getApprovalStatus", () => {
    it("should construct /api/meetings/:meetingId/minutes-approval path", async () => {
      const meetingId = "meeting-101";
      const mockResult = {
        data: {
          success: true,
          status: "pending",
          data: {
            _id: "approval-1",
            meetingId,
            status: "pending",
            approvals: [],
          },
        },
      };
      apiClient.get.mockResolvedValueOnce(mockResult);

      const res = await minutesApprovalApi.getApprovalStatus(meetingId);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/minutes-approval`,
      );
      expect(res.data.status).toBe("pending");
      expect(res.data.data._id).toBe("approval-1");
    });
  });

  describe("submitApproval", () => {
    it("should send snapshotSummary and approvers payload to /api/meetings/:id/minutes-approval/submit", async () => {
      const meetingId = "meeting-202";
      const snapshotSummary = "Finalized quarterly strategy summary";
      const approvers = ["user-1", "user-2"];

      apiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            _id: "app-202",
            meetingId,
            snapshotSummary,
            status: "pending",
            approvals: [
              { approver: "user-1", status: "pending" },
              { approver: "user-2", status: "pending" },
            ],
          },
        },
      });

      const res = await minutesApprovalApi.submitApproval(
        meetingId,
        snapshotSummary,
        approvers,
      );

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/minutes-approval/submit`,
        {
          snapshotSummary,
          approvers,
        },
      );
      expect(res.data.success).toBe(true);
      expect(res.data.data.snapshotSummary).toBe(snapshotSummary);
    });
  });

  describe("respondApproval", () => {
    it("should send status and comment to /api/meetings/:id/minutes-approval/respond", async () => {
      const meetingId = "meeting-404";
      const status = "approved";
      const comment = "Looks solid!";

      apiClient.put.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            _id: "app-404",
            status: "approved",
          },
        },
      });

      const res = await minutesApprovalApi.respondApproval(
        meetingId,
        status,
        comment,
      );

      expect(apiClient.put).toHaveBeenCalledTimes(1);
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/minutes-approval/respond`,
        {
          status,
          comment,
        },
      );
      expect(res.data.success).toBe(true);
    });
  });
});
