/**
 * Issue #817 — Enforce Meeting Authorization for Agenda Pacing Reports
 *
 * Agenda pacing reports previously relied only on authentication (`userAuth`)
 * and did not verify access/organization ownership for the requested meeting.
 *
 * Fix: enforce `requireOrgAccess(Meeting)` and `requirePermission("meetings", "view")`
 * on `GET /api/meetings/timer/:meetingId/pacing`.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import mongoose from "mongoose";

const mockMeetingFindById = vi.fn();

vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

import { requireOrgAccess } from "../middleware/rbac.js";
import { getAgendaPacingReport } from "../controllers/agendaTimerController.js";
import Meeting from "../models/meetingModel.js";

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const userInOrg = (org = ORG_A, role = "member") => ({
  _id: new mongoose.Types.ObjectId(),
  organization: org,
  role,
});

describe("Agenda Pacing Report Authorization (#817)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireOrgAccess middleware for pacing route", () => {
    it("blocks access with 403 when user belongs to a different organization", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const meeting = {
        _id: meetingId,
        organization: ORG_A,
        uploadedBy: new mongoose.Types.ObjectId(),
      };
      mockMeetingFindById.mockResolvedValue(meeting);

      const req = {
        params: { meetingId: meetingId.toString() },
        user: userInOrg(ORG_B),
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/don't have access/i);
      expect(next).not.toHaveBeenCalled();
    });

    it("blocks access with 403 when user has no organization", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const req = {
        params: { meetingId: meetingId.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: "member" },
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/organization membership required/i);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 404 when meeting does not exist", async () => {
      mockMeetingFindById.mockResolvedValue(null);

      const req = {
        params: { meetingId: new mongoose.Types.ObjectId().toString() },
        user: userInOrg(ORG_A),
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Resource not found");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when meetingId format is invalid", async () => {
      const req = {
        params: { meetingId: "invalid-id" },
        user: userInOrg(ORG_A),
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid Document ID format");
      expect(next).not.toHaveBeenCalled();
    });

    it("allows access and sets req.doc when user belongs to same organization", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const meeting = {
        _id: meetingId,
        organization: ORG_A,
        uploadedBy: new mongoose.Types.ObjectId(),
        agendaItems: [],
        agendaProgress: "not_started",
      };
      mockMeetingFindById.mockResolvedValue(meeting);

      const req = {
        params: { meetingId: meetingId.toString() },
        user: userInOrg(ORG_A),
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.doc).toBe(meeting);
    });

    it("allows access for meeting owner even across organizations", async () => {
      const uploaderId = new mongoose.Types.ObjectId();
      const meetingId = new mongoose.Types.ObjectId();
      const meeting = {
        _id: meetingId,
        organization: ORG_A,
        uploadedBy: uploaderId,
      };
      mockMeetingFindById.mockResolvedValue(meeting);

      const req = {
        params: { meetingId: meetingId.toString() },
        user: { _id: uploaderId, organization: ORG_B, role: "member" },
      };
      const res = makeRes();
      const next = vi.fn();

      const middleware = requireOrgAccess(Meeting);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.doc).toBe(meeting);
    });
  });

  describe("getAgendaPacingReport controller", () => {
    it("generates correct pacing report when authorized (using req.doc)", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const itemId1 = new mongoose.Types.ObjectId();
      const itemId2 = new mongoose.Types.ObjectId();

      const req = {
        params: { meetingId: meetingId.toString() },
        user: userInOrg(ORG_A),
        doc: {
          _id: meetingId,
          agendaProgress: "in_progress",
          agendaItems: [
            {
              _id: itemId1,
              text: "Intro",
              duration: 10,
              actualDuration: 900000, // 15 min -> over time
              status: "completed",
            },
            {
              _id: itemId2,
              text: "Wrap up",
              duration: 5,
              actualDuration: 0,
              status: "skipped",
            },
          ],
        },
      };

      const res = makeRes();
      await getAgendaPacingReport(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reportData).toHaveLength(2);
      expect(res.body.summaryStats.totalPlanned).toBe(15);
      expect(res.body.summaryStats.totalActual).toBe(15);
      expect(res.body.summaryStats.itemsSkipped).toBe(1);
      expect(res.body.summaryStats.itemsOverTime).toBe(1);
    });
  });
});
