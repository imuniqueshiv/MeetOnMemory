import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockGetMeetingAttendance = jest.fn();
const mockCheckIn = jest.fn();
const mockCheckOut = jest.fn();

jest.unstable_mockModule(
  "../controllers/meetingAttendanceController.js",
  () => ({
    getMeetingAttendance: (...args) => mockGetMeetingAttendance(...args),
    checkIn: (...args) => mockCheckIn(...args),
    checkOut: (...args) => mockCheckOut(...args),
    markExcused: jest.fn(),
    finalizeAttendance: jest.fn(),
  }),
);

const mockUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  name: "Attendee User",
  email: "attendee@example.com",
};

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = mockUser;
    next();
  },
  sanitizeAuthRequestForLog: jest.fn(),
}));

const { default: attendanceRoutes } =
  await import("../routes/meetingAttendanceRoutes.js");

describe("Meeting Attendance Server Integration Tests (#2666)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/meetings/:meetingId/attendance", attendanceRoutes);
  });

  describe("GET /api/meetings/:meetingId/attendance", () => {
    it("returns attendance records for meeting", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockRecords = [
        {
          meetingId,
          email: "attendee@example.com",
          checkInTime: new Date().toISOString(),
          status: "present",
        },
      ];

      mockGetMeetingAttendance.mockImplementation((req, res) =>
        res.status(200).json(mockRecords),
      );

      const res = await request(app)
        .get(`/api/meetings/${meetingId}/attendance`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRecords);
    });

    it("returns 401 unauthenticated when authorization header is missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(
        `/api/meetings/${meetingId}/attendance`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/meetings/:meetingId/attendance/checkin", () => {
    it("checks in participant successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockAttendance = {
        meetingId,
        email: "john@example.com",
        name: "John Doe",
        checkInTime: new Date().toISOString(),
        status: "present",
      };

      mockCheckIn.mockImplementation((req, res) => {
        const { email, name: _name } = req.body;
        if (!email) {
          return res
            .status(400)
            .json({ message: "Email is required for check-in" });
        }
        res.status(200).json(mockAttendance);
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkin`)
        .set("Authorization", "Bearer valid-token")
        .send({
          email: "john@example.com",
          name: "John Doe",
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttendance);
    });

    it("returns 400 validation error when email is missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      mockCheckIn.mockImplementation((req, res) => {
        const { email } = req.body;
        if (!email) {
          return res
            .status(400)
            .json({ message: "Email is required for check-in" });
        }
        res.status(200).json({});
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkin`)
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required for check-in");
    });
  });

  describe("POST /api/meetings/:meetingId/attendance/checkout", () => {
    it("checks out participant successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockAttendance = {
        meetingId,
        email: "john@example.com",
        checkOutTime: new Date().toISOString(),
        durationMinutes: 45,
      };

      mockCheckOut.mockImplementation((req, res) => {
        const { email } = req.body;
        if (!email) {
          return res
            .status(400)
            .json({ message: "Email is required for check-out" });
        }
        res.status(200).json(mockAttendance);
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkout`)
        .set("Authorization", "Bearer valid-token")
        .send({
          email: "john@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttendance);
    });

    it("returns 400 validation error when email is missing on checkout", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      mockCheckOut.mockImplementation((req, res) => {
        const { email } = req.body;
        if (!email) {
          return res
            .status(400)
            .json({ message: "Email is required for check-out" });
        }
        res.status(200).json({});
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkout`)
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required for check-out");
    });
  });
});
