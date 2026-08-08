/**
 * Issue #819 — Bookmark creation allowed cross-organization meeting IDs.
 *
 * The toggleBookmark handler created bookmarks without verifying that the
 * target meeting belongs to the caller's organization. Any authenticated user
 * could bookmark meetings from other organizations given only the meeting ID.
 *
 * Fix: validate meeting existence and assert meeting.organization matches
 * req.user.organization before creating a bookmark. Returns 404 when the
 * meeting does not exist and 403 when it belongs to a different organization.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import mongoose from "mongoose";

// --- Mocks ---

const mockBookmarkFindOne = vi.fn();
const mockBookmarkDeleteOne = vi.fn();
const mockBookmarkCreate = vi.fn();

vi.mock("../models/bookmarkModel.js", () => ({
  default: {
    findOne: (...args) => mockBookmarkFindOne(...args),
    deleteOne: (...args) => mockBookmarkDeleteOne(...args),
    create: (...args) => mockBookmarkCreate(...args),
  },
}));

const mockMeetingFindById = vi.fn();

vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

import { toggleBookmark } from "../controllers/bookmarkController.js";

// --- Helpers ---

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

const makeReq = (meetingId, user) => ({
  body: { meetingId },
  user,
});

const userInOrgA = () => ({
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
});

const userInOrgB = () => ({
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
});

describe("toggleBookmark — organization ownership (#819)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cross-organization bookmark prevention", () => {
    it("returns 403 when caller's org does not match meeting's org", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: ORG_A }),
      });

      const res = makeRes();
      await toggleBookmark(makeReq(meetingId.toString(), userInOrgB()), res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/does not belong to your organization/i);
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });

    it("returns 403 and does not remove an existing bookmark when caller's org does not match meeting's org", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const existingBookmark = { _id: new mongoose.Types.ObjectId() };

      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: ORG_A }),
      });
      mockBookmarkFindOne.mockResolvedValue(existingBookmark);

      const res = makeRes();
      await toggleBookmark(makeReq(meetingId.toString(), userInOrgB()), res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/does not belong to your organization/i);
      expect(mockBookmarkDeleteOne).not.toHaveBeenCalled();
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });

    it("returns 403 when the caller has no organization", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: ORG_A }),
      });

      const res = makeRes();
      await toggleBookmark(
        makeReq(meetingId.toString(), { _id: new mongoose.Types.ObjectId() }),
        res,
      );

      expect(res.statusCode).toBe(403);
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });

    it("returns 403 when the meeting has no organization", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: null }),
      });

      const res = makeRes();
      await toggleBookmark(makeReq(meetingId.toString(), userInOrgA()), res);

      expect(res.statusCode).toBe(403);
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });
  });

  describe("resource existence validation", () => {
    it("returns 404 when the meeting does not exist", async () => {
      mockMeetingFindById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const res = makeRes();
      await toggleBookmark(
        makeReq(new mongoose.Types.ObjectId().toString(), userInOrgA()),
        res,
      );

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Meeting not found");
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed meetingId", async () => {
      const res = makeRes();
      await toggleBookmark(makeReq("not-an-objectid", userInOrgA()), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid meetingId");
      expect(mockMeetingFindById).not.toHaveBeenCalled();
    });

    it("returns 400 when meetingId is missing", async () => {
      const res = makeRes();
      await toggleBookmark({ body: {}, user: userInOrgA() }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("meetingId is required");
    });
  });

  describe("authorized bookmark operations", () => {
    it("creates a bookmark when meeting belongs to caller's org (toggle on)", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const user = userInOrgA();
      const created = {
        _id: new mongoose.Types.ObjectId(),
        meeting: meetingId,
        user: user._id,
      };

      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: ORG_A }),
      });
      mockBookmarkFindOne.mockResolvedValue(null);
      mockBookmarkCreate.mockResolvedValue(created);

      const res = makeRes();
      await toggleBookmark(makeReq(meetingId.toString(), user), res);

      expect(res.statusCode).toBe(201);
      expect(res.body.bookmarked).toBe(true);
      expect(mockBookmarkCreate).toHaveBeenCalledOnce();
    });

    it("removes a bookmark when meeting belongs to caller's org (toggle off)", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const user = userInOrgA();
      const existing = { _id: new mongoose.Types.ObjectId() };

      mockMeetingFindById.mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: meetingId, organization: ORG_A }),
      });
      mockBookmarkFindOne.mockResolvedValue(existing);
      mockBookmarkDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = makeRes();
      await toggleBookmark(makeReq(meetingId.toString(), user), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.bookmarked).toBe(false);
      expect(mockBookmarkDeleteOne).toHaveBeenCalledOnce();
      expect(mockBookmarkCreate).not.toHaveBeenCalled();
    });
  });
});
