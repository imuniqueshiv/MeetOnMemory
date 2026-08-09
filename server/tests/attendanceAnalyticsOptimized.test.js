import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import {
  getMemberAttendanceStats,
  getAttendanceHeatmap,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../controllers/attendanceAnalyticsController.js";

describe("Optimize Attendance Analytics Queries (#830)", () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { organization: dummyOrgId },
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe("getMemberAttendanceStats", () => {
    it("uses MongoDB aggregation and returns correct member stats", async () => {
      vi.spyOn(Meeting, "countDocuments").mockResolvedValue(2);
      vi.spyOn(Meeting, "aggregate").mockResolvedValue([
        {
          name: "Alice",
          email: "alice@example.com",
          attended: 2,
          datesAttended: ["2026-08-01", "2026-08-02"],
        },
      ]);

      await getMemberAttendanceStats(req, res);

      expect(Meeting.countDocuments).toHaveBeenCalledWith({
        organization: dummyOrgId,
      });
      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalMeetings: 2,
        stats: [
          {
            name: "Alice",
            email: "alice@example.com",
            attended: 2,
            attendanceRate: 100,
            sparkline: ["2026-08-01", "2026-08-02"],
          },
        ],
      });
    });
  });

  describe("getAttendanceHeatmap", () => {
    it("uses MongoDB aggregation to group daily counts", async () => {
      vi.spyOn(Meeting, "aggregate").mockResolvedValue([
        { date: "2026-08-01", count: 3 },
        { date: "2026-08-02", count: 1 },
      ]);

      await getAttendanceHeatmap(req, res);

      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { date: "2026-08-01", count: 3 },
        { date: "2026-08-02", count: 1 },
      ]);
    });
  });

  describe("getAttendanceTrends", () => {
    it("aggregates trends by specified granularity", async () => {
      req.query = { granularity: "monthly" };
      vi.spyOn(Meeting, "aggregate").mockResolvedValue([
        {
          dateLabel: "2026-08",
          meetings: 4,
          totalParticipants: 16,
          avgParticipants: 4,
        },
      ]);

      await getAttendanceTrends(req, res);

      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        {
          dateLabel: "2026-08",
          meetings: 4,
          totalParticipants: 16,
          avgParticipants: 4,
        },
      ]);
    });
  });

  describe("getMeetingTypeBreakdown", () => {
    it("aggregates meeting counts by meetingType", async () => {
      vi.spyOn(Meeting, "aggregate").mockResolvedValue([
        { name: "conference", value: 5 },
        { name: "internal", value: 2 },
      ]);

      await getMeetingTypeBreakdown(req, res);

      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { name: "conference", value: 5 },
        { name: "internal", value: 2 },
      ]);
    });
  });
});
