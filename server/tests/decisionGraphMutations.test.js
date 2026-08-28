import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDecision,
  linkDecisions,
  supersedeDecision,
} from "../controllers/decisionGraphController.js";
import Decision from "../models/decisionModel.js";
import Meeting from "../models/meetingModel.js";

vi.mock("../models/decisionModel.js", () => ({
  default: { create: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../models/meetingModel.js", () => ({
  default: { findOne: vi.fn() },
}));

// A query-like object that both awaits to `doc` and supports `.select()`.
const query = (doc) => ({
  select: () => Promise.resolve(doc),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

const mockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const OID_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OID_B = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("decisionGraph mutations (#2027)", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createDecision", () => {
    it("creates a decision for a meeting in the caller's org (201)", async () => {
      Meeting.findOne.mockReturnValue(query({ _id: OID_A }));
      Decision.create.mockResolvedValue({
        _id: { toString: () => "d1" },
        text: "Adopt Rust",
        owner: "alice",
        status: "open",
      });
      const req = {
        user: { organization: "org1" },
        body: { text: "Adopt Rust", owner: "alice", sourceMeetingId: OID_A },
      };
      const res = mockRes();
      await createDecision(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Decision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Adopt Rust",
          organization: "org1",
          sourceMeetingId: OID_A,
        }),
      );
    });

    it("rejects missing text (400)", async () => {
      const res = mockRes();
      await createDecision(
        { user: { organization: "org1" }, body: { sourceMeetingId: OID_A } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(Decision.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid sourceMeetingId (400)", async () => {
      const res = mockRes();
      await createDecision(
        {
          user: { organization: "org1" },
          body: { text: "x", sourceMeetingId: "not-an-id" },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("404s when the source meeting is not in the org", async () => {
      Meeting.findOne.mockReturnValue(query(null));
      const res = mockRes();
      await createDecision(
        {
          user: { organization: "org1" },
          body: { text: "x", sourceMeetingId: OID_A },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(Decision.create).not.toHaveBeenCalled();
    });
  });

  describe("linkDecisions", () => {
    it("adds a relatesTo edge and saves (200)", async () => {
      const source = { relatesTo: [], save: vi.fn().mockResolvedValue(true) };
      Decision.findOne.mockImplementation((q) =>
        query(q._id === OID_A ? source : { _id: OID_B }),
      );
      const res = mockRes();
      await linkDecisions(
        {
          user: { organization: "org1" },
          params: { id: OID_A },
          body: { targetId: OID_B, confidence: 80 },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(source.relatesTo).toEqual([{ target: OID_B, confidence: 80 }]);
      expect(source.save).toHaveBeenCalled();
    });

    it("rejects a self-link (400) without touching the DB", async () => {
      const res = mockRes();
      await linkDecisions(
        {
          user: { organization: "org1" },
          params: { id: OID_A },
          body: { targetId: OID_A },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(Decision.findOne).not.toHaveBeenCalled();
    });

    it("409s when the edge already exists", async () => {
      const source = {
        relatesTo: [{ target: { toString: () => OID_B } }],
        save: vi.fn(),
      };
      Decision.findOne.mockImplementation((q) =>
        query(q._id === OID_A ? source : { _id: OID_B }),
      );
      const res = mockRes();
      await linkDecisions(
        {
          user: { organization: "org1" },
          params: { id: OID_A },
          body: { targetId: OID_B },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(source.save).not.toHaveBeenCalled();
    });

    it("404s when a decision is not in the org", async () => {
      Decision.findOne.mockImplementation((q) =>
        query(q._id === OID_A ? null : { _id: OID_B }),
      );
      const res = mockRes();
      await linkDecisions(
        {
          user: { organization: "org1" },
          params: { id: OID_A },
          body: { targetId: OID_B },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("supersedeDecision", () => {
    it("marks the decision superseded and saves (200)", async () => {
      const source = { save: vi.fn().mockResolvedValue(true) };
      Decision.findOne.mockImplementation((q) =>
        query(q._id === OID_A ? source : { _id: OID_B }),
      );
      const res = mockRes();
      await supersedeDecision(
        {
          user: { organization: "org1" },
          params: { id: OID_A },
          body: { targetId: OID_B },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(source.supersededByMemory).toBe(OID_B);
      expect(source.status).toBe("superseded");
      expect(source.save).toHaveBeenCalled();
    });
  });
});
