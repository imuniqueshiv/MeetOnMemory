/**
 * Issue #1071 — unbounded `?limit=` on list endpoints.
 *
 * `parseInt(req.query.limit) || <default>` was passed straight to `.limit()`,
 * so `?limit=10000000` streamed millions of documents into the heap and
 * `?page=0` produced a negative skip that MongoDB rejected as a 500.
 *
 * The clamping rule already existed in three places
 * (`knowledgeController` → 100, `decisionGraphController` → 200,
 * `notificationController` → 100) written three different ways, and was missed
 * in four others. These suites pin the shared helper's contract and then check
 * each previously-unbounded endpoint actually uses it.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import {
  buildPaginationMeta,
  parsePagination,
  DEFAULT_MAX_LIMIT,
  DEFAULT_PAGE_SIZE,
} from "../utils/pagination.js";

import Comment from "../models/commentModel.js";
import Meeting from "../models/meetingModel.js";
import Attachment from "../models/attachmentModel.js";
import "../models/userModel.js";
import { getCommentsByMeeting } from "../controllers/commentController.js";
import { listAttachments } from "../controllers/attachmentController.js";
import { getMeetingsByTag } from "../controllers/tagController.js";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

describe("parsePagination (#1071)", () => {
  describe("defaults", () => {
    it("returns page 1 and the endpoint default when nothing is requested", () => {
      expect(parsePagination({})).toEqual({
        page: 1,
        limit: DEFAULT_PAGE_SIZE,
        skip: 0,
        limitWasClamped: false,
      });
    });

    it("honours a per-endpoint default limit", () => {
      expect(parsePagination({}, { defaultLimit: 50 }).limit).toBe(50);
    });

    it("never lets a default exceed the endpoint ceiling", () => {
      expect(
        parsePagination({}, { defaultLimit: 500, maxLimit: 25 }).limit,
      ).toBe(25);
    });

    it("tolerates a missing query object entirely", () => {
      expect(parsePagination().page).toBe(1);
      expect(parsePagination(undefined).limit).toBe(DEFAULT_PAGE_SIZE);
    });
  });

  describe("the ceiling", () => {
    it("clamps an absurd limit to the default maximum", () => {
      const result = parsePagination({ limit: "10000000" });
      expect(result.limit).toBe(DEFAULT_MAX_LIMIT);
      expect(result.limitWasClamped).toBe(true);
    });

    it("clamps to a per-endpoint maximum", () => {
      expect(parsePagination({ limit: "999" }, { maxLimit: 200 }).limit).toBe(
        200,
      );
    });

    it("does not clamp a limit inside the ceiling", () => {
      const result = parsePagination({ limit: "35" });
      expect(result.limit).toBe(35);
      expect(result.limitWasClamped).toBe(false);
    });

    it("clamps rather than rejecting, so existing clients keep working", () => {
      // A client that has always sent limit=500 gets a capped page, not a 400.
      expect(() => parsePagination({ limit: "500" })).not.toThrow();
      expect(parsePagination({ limit: "500" }).limit).toBe(DEFAULT_MAX_LIMIT);
    });
  });

  describe("the floor", () => {
    it("never produces a negative skip", () => {
      for (const page of ["0", "-1", "-99999"]) {
        const result = parsePagination({ page });
        expect(result.page).toBe(1);
        expect(result.skip).toBe(0);
      }
    });

    it("never produces a limit below 1", () => {
      for (const limit of ["0", "-5"]) {
        expect(parsePagination({ limit }).limit).toBe(DEFAULT_PAGE_SIZE);
      }
    });

    it("computes skip from the clamped values, not the requested ones", () => {
      expect(parsePagination({ page: "3", limit: "10" }).skip).toBe(20);
      expect(parsePagination({ page: "0", limit: "10" }).skip).toBe(0);
    });
  });

  describe("parsing", () => {
    it("falls back to the default for non-numeric input", () => {
      for (const limit of ["abc", "  ", "null", "undefined", "{}"]) {
        expect(parsePagination({ limit }).limit).toBe(DEFAULT_PAGE_SIZE);
      }
    });

    it("rejects exponent notation instead of silently reading it as 1", () => {
      // `parseInt("1e5", 10)` is 1 — the caller asked for 100000 and would
      // have quietly received 1.
      expect(parsePagination({ limit: "1e5" }).limit).toBe(DEFAULT_PAGE_SIZE);
    });

    it("rejects values with trailing junk", () => {
      expect(parsePagination({ limit: "12abc" }).limit).toBe(DEFAULT_PAGE_SIZE);
      expect(parsePagination({ page: "3xyz" }).page).toBe(1);
    });

    it("rejects floats", () => {
      expect(parsePagination({ limit: "4.5" }).limit).toBe(DEFAULT_PAGE_SIZE);
    });

    it("accepts a genuine number, not only a string", () => {
      expect(parsePagination({ page: 2, limit: 15 })).toEqual({
        page: 2,
        limit: 15,
        skip: 15,
        limitWasClamped: false,
      });
    });

    it("takes the last value when a query key is repeated", () => {
      // `?limit=5&limit=9` arrives as an array.
      expect(parsePagination({ limit: ["5", "9"] }).limit).toBe(9);
    });

    it("falls back to defaults for values beyond the safe integer range", () => {
      // Not clamped to the ceiling — treated as unusable input, because a value
      // this large is a malformed request rather than an ambitious one.
      expect(parsePagination({ limit: "999999999999999999999" }).limit).toBe(
        DEFAULT_PAGE_SIZE,
      );
      expect(parsePagination({ page: "999999999999999999999" }).page).toBe(1);
    });
  });
});

describe("buildPaginationMeta (#1071)", () => {
  it("reports hasMore while pages remain", () => {
    expect(buildPaginationMeta({ total: 95, page: 1, limit: 20 })).toEqual({
      total: 95,
      page: 1,
      limit: 20,
      totalPages: 5,
      hasMore: true,
    });
  });

  it("reports hasMore false on the last page", () => {
    expect(buildPaginationMeta({ total: 95, page: 5, limit: 20 }).hasMore).toBe(
      false,
    );
  });

  it("reports hasMore false on an exactly-full last page", () => {
    expect(buildPaginationMeta({ total: 40, page: 2, limit: 20 }).hasMore).toBe(
      false,
    );
  });

  it("handles an empty result set", () => {
    expect(buildPaginationMeta({ total: 0, page: 1, limit: 20 })).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasMore: false,
    });
  });
});

// ─── Endpoint integration ──────────────────────────────────────────────────

const ORG = new mongoose.Types.ObjectId();
const AUTHOR = new mongoose.Types.ObjectId();

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const seedMeeting = () =>
  Meeting.create({
    title: "Retro",
    date: new Date(),
    organization: ORG,
    uploadedBy: AUTHOR,
    tags: ["retro"],
  });

describe("list endpoints respect the ceiling (#1071)", () => {
  it("caps getCommentsByMeeting at the maximum page size", async () => {
    const meeting = await seedMeeting();

    await Comment.insertMany(
      Array.from({ length: 130 }, (_, i) => ({
        meeting: meeting._id,
        author: AUTHOR,
        organization: ORG,
        body: `comment ${i}`,
      })),
    );

    const res = makeRes();
    await getCommentsByMeeting(
      {
        params: { meetingId: meeting._id.toString() },
        query: { limit: "10000000" },
        user: { id: AUTHOR, organization: ORG, role: "admin" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.comments.length).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.pagination.total).toBe(130);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it("answers 200, not 500, for a zero or negative page", async () => {
    const meeting = await seedMeeting();
    await Comment.create({
      meeting: meeting._id,
      author: AUTHOR,
      organization: ORG,
      body: "only one",
    });

    for (const page of ["0", "-3"]) {
      const res = makeRes();
      await getCommentsByMeeting(
        {
          params: { meetingId: meeting._id.toString() },
          query: { page },
          user: { id: AUTHOR, organization: ORG, role: "admin" },
        },
        res,
      );

      // A negative skip used to reach MongoDB and come back as a 500.
      expect(res.statusCode).toBe(200);
      expect(res.body.comments.length).toBe(1);
      expect(res.body.currentPage).toBe(1);
    }
  });

  it("keeps the legacy comment response fields alongside the new envelope", async () => {
    const meeting = await seedMeeting();
    await Comment.create({
      meeting: meeting._id,
      author: AUTHOR,
      organization: ORG,
      body: "hi",
    });

    const res = makeRes();
    await getCommentsByMeeting(
      {
        params: { meetingId: meeting._id.toString() },
        query: {},
        user: { id: AUTHOR, organization: ORG, role: "admin" },
      },
      res,
    );

    expect(res.body.currentPage).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.totalComments).toBe(1);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it("caps listAttachments at the maximum page size", async () => {
    const meeting = await seedMeeting();

    await Attachment.insertMany(
      Array.from({ length: 120 }, (_, i) => ({
        meeting: meeting._id,
        fileName: `file-${i}.pdf`,
        fileType: "pdf",
        filePath: `uploads/attachments/file-${i}.pdf`,
        fileSize: 100,
        mimeType: "application/pdf",
        uploadedBy: AUTHOR,
      })),
    );

    const res = makeRes();
    await listAttachments(
      {
        params: { meetingId: meeting._id.toString() },
        query: { limit: "500000" },
        user: { id: AUTHOR, organization: ORG, role: "admin" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.attachments.length).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.pagination.total).toBe(120);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it("caps getMeetingsByTag at the maximum page size", async () => {
    await Meeting.insertMany(
      Array.from({ length: 115 }, (_, i) => ({
        title: `Tagged ${i}`,
        date: new Date(),
        organization: ORG,
        uploadedBy: AUTHOR,
        tags: ["quarterly"],
      })),
    );

    const res = makeRes();
    await getMeetingsByTag(
      {
        params: { name: "quarterly" },
        query: { limit: "9999999" },
        user: { id: AUTHOR, organization: ORG, role: "admin" },
      },
      res,
      jest.fn(),
    );

    // `sendSuccess` spreads the payload at the top level.
    expect(res.body.meetings.length).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.pagination.total).toBe(115);
    expect(res.body.totalCount).toBe(115);
  });
});
