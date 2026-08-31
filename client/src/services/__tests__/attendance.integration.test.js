import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import * as meetingAttendanceApi from "../meetingAttendanceApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("Meeting Attendance Client Service Integration Tests (#2666)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contract Assertions", () => {
    it("should call GET /meetings/:meetingId/attendance when fetching attendance", async () => {
      const mockResponse = {
        data: [{ email: "user@example.com", status: "invited" }],
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      const res = await meetingAttendanceApi.getMeetingAttendance("m-100");

      expect(apiClient.get).toHaveBeenCalledWith("/meetings/m-100/attendance");
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /meetings/:meetingId/attendance/checkin with email & joinTime", async () => {
      const mockResponse = {
        data: { email: "user@example.com", status: "checked_in" },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const joinTime = "2026-08-29T10:00:00.000Z";
      const res = await meetingAttendanceApi.checkIn(
        "m-100",
        "user@example.com",
        joinTime,
      );

      expect(apiClient.post).toHaveBeenCalledWith(
        "/meetings/m-100/attendance/checkin",
        {
          email: "user@example.com",
          joinTime,
        },
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /meetings/:meetingId/attendance/checkout with email & leaveTime", async () => {
      const mockResponse = {
        data: { email: "user@example.com", status: "checked_out" },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const leaveTime = "2026-08-29T11:00:00.000Z";
      const res = await meetingAttendanceApi.checkOut(
        "m-100",
        "user@example.com",
        leaveTime,
      );

      expect(apiClient.post).toHaveBeenCalledWith(
        "/meetings/m-100/attendance/checkout",
        {
          email: "user@example.com",
          leaveTime,
        },
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call PUT /meetings/:meetingId/attendance/excuse when marking excused", async () => {
      const mockResponse = {
        data: { email: "user@example.com", status: "excused" },
      };
      apiClient.put.mockResolvedValueOnce(mockResponse);

      const res = await meetingAttendanceApi.markExcused(
        "m-100",
        "user@example.com",
      );

      expect(apiClient.put).toHaveBeenCalledWith(
        "/meetings/m-100/attendance/excuse",
        { email: "user@example.com" },
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /meetings/:meetingId/attendance/finalize when finalizing", async () => {
      const mockResponse = {
        data: { message: "Attendance finalized successfully" },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const res = await meetingAttendanceApi.finalizeAttendance("m-100");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/meetings/m-100/attendance/finalize",
      );
      expect(res).toEqual(mockResponse);
    });
  });

  describe("Negative Error Handling Contracts", () => {
    it("handles 401 unauthenticated error", async () => {
      const authError = new Error("Session expired. Please log in again.");
      authError.response = { status: 401, data: { message: "Unauthorized" } };
      apiClient.get.mockRejectedValueOnce(authError);

      await expect(
        meetingAttendanceApi.getMeetingAttendance("m-100"),
      ).rejects.toThrow("Session expired");
    });

    it("handles 400 validation error when check-in email is missing", async () => {
      const valError = new Error("Email is required for check-in");
      valError.response = {
        status: 400,
        data: { message: "Email is required for check-in" },
      };
      apiClient.post.mockRejectedValueOnce(valError);

      await expect(meetingAttendanceApi.checkIn("m-100", null)).rejects.toThrow(
        "Email is required for check-in",
      );
    });

    it("handles 400 validation error when check-out email is missing", async () => {
      const valError = new Error("Email is required for check-out");
      valError.response = {
        status: 400,
        data: { message: "Email is required for check-out" },
      };
      apiClient.post.mockRejectedValueOnce(valError);

      await expect(meetingAttendanceApi.checkOut("m-100", "")).rejects.toThrow(
        "Email is required for check-out",
      );
    });
  });
});
