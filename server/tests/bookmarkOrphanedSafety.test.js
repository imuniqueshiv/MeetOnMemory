import { vi, describe, it, expect, beforeEach } from "vitest";
import mongoose from "mongoose";

const mockBookmarkFindOne = vi.fn();
const mockBookmarkDeleteOne = vi.fn();
const mockBookmarkFind = vi.fn();
const mockBookmarkPopulate = vi.fn();

vi.mock("../models/bookmarkModel.js", () => ({
  default: {
    findOne: (...args) => mockBookmarkFindOne(...args),
    deleteOne: (...args) => mockBookmarkDeleteOne(...args),
    find: (...args) => mockBookmarkFind(...args),
    populate: (...args) => mockBookmarkPopulate(...args),
  },
}));

const mockMeetingFindById = vi.fn();

vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

import {
  toggleBookmark,
  getBookmarks,
} from "../controllers/bookmarkController.js";

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

describe("Bookmark Orphaned Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows removing bookmark of deleted meeting", async () => {
    const meetingId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const bookmarkId = new mongoose.Types.ObjectId();

    mockMeetingFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null), // Meeting not found
    });

    mockBookmarkFindOne.mockResolvedValue({
      _id: bookmarkId,
    });

    const req = {
      body: { meetingId: meetingId.toString() },
      user: { _id: userId },
    };
    const res = makeRes();

    await toggleBookmark(req, res);

    expect(mockBookmarkFindOne).toHaveBeenCalledWith({
      user: userId,
      meeting: meetingId.toString(),
    });
    expect(mockBookmarkDeleteOne).toHaveBeenCalledWith({ _id: bookmarkId });
    expect(res.statusCode).toBe(200);
    expect(res.body.bookmarked).toBe(false);
  });

  it("returns rawMeetingId in getBookmarks payload", async () => {
    const userId = new mongoose.Types.ObjectId();
    const meetingId = new mongoose.Types.ObjectId();
    const bookmarkId = new mongoose.Types.ObjectId();

    const mockBookmark = {
      _id: bookmarkId,
      user: userId,
      meeting: meetingId,
      collectionName: "Favorites",
      toObject: function () {
        return {
          _id: this._id,
          user: this.user,
          meeting: this.meeting,
          collectionName: this.collectionName,
        };
      },
    };

    mockBookmarkFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([mockBookmark]),
    });

    const req = {
      user: { _id: userId },
      query: {},
    };
    const res = makeRes();

    await getBookmarks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rawMeetingId).toBe(meetingId.toString());
  });
});
