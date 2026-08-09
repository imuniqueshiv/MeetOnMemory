import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/decisionModel.js", () => ({
  default: {
    aggregate: vi.fn(),
    collection: { name: "decisions" },
  },
}));

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    aggregate: vi.fn(),
    collection: { name: "actionitems" },
  },
}));

const Decision = (await import("../models/decisionModel.js")).default;
const ActionItem = (await import("../models/actionItemModel.js")).default;
const { buildArchiveMatch, buildArchivePipeline, getArchivedMemoriesPage } =
  await import("../services/archivedKnowledgeService.js");

describe("archivedKnowledgeService (#901)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildArchiveMatch", () => {
    it("filters by organization and archived lifecycle state", () => {
      const orgId = new mongoose.Types.ObjectId();
      const match = buildArchiveMatch({ organization: orgId });

      expect(match.lifecycleState).toBe("archived");
      expect(String(match.organization)).toBe(String(orgId));
      expect(match.text).toBeUndefined();
    });

    it("adds a case-insensitive text search when provided", () => {
      const match = buildArchiveMatch({
        organization: "507f1f77bcf86cd799439011",
        search: "  budget  ",
      });

      expect(match.text).toEqual({ $regex: "budget", $options: "i" });
    });
  });

  describe("buildArchivePipeline", () => {
    it("unions decisions and action items for the All view", () => {
      const pipeline = buildArchivePipeline({
        type: "all",
        organization: "507f1f77bcf86cd799439011",
        skip: 10,
        limit: 10,
      });

      expect(pipeline[0]).toEqual(
        expect.objectContaining({ $match: expect.any(Object) }),
      );
      expect(pipeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            $unionWith: expect.objectContaining({
              coll: "actionitems",
            }),
          }),
        ]),
      );

      const facet = pipeline.find((stage) => stage.$facet);
      expect(facet.$facet.data[0]).toEqual({ $skip: 10 });
      expect(facet.$facet.data[1]).toEqual({ $limit: 10 });
      expect(facet.$facet.metadata).toEqual([{ $count: "total" }]);
    });

    it("does not union when filtering to a single memory type", () => {
      const decisionPipeline = buildArchivePipeline({
        type: "decision",
        organization: "507f1f77bcf86cd799439011",
        skip: 0,
        limit: 10,
      });
      const actionPipeline = buildArchivePipeline({
        type: "action-item",
        organization: "507f1f77bcf86cd799439011",
        skip: 0,
        limit: 10,
      });

      expect(decisionPipeline.some((stage) => stage.$unionWith)).toBe(false);
      expect(actionPipeline.some((stage) => stage.$unionWith)).toBe(false);
      expect(decisionPipeline[1].$addFields.type).toBe("decision");
      expect(actionPipeline[1].$addFields.type).toBe("action-item");
    });
  });

  describe("getArchivedMemoriesPage", () => {
    it("returns a correctly paginated combined page", async () => {
      Decision.aggregate.mockResolvedValue([
        {
          metadata: [{ total: 25 }],
          data: [
            { _id: "d1", type: "decision", text: "Decide A" },
            { _id: "a1", type: "action-item", text: "Do B" },
          ],
        },
      ]);

      const result = await getArchivedMemoriesPage({
        organization: "507f1f77bcf86cd799439011",
        type: "all",
        page: 2,
        limit: 10,
      });

      expect(Decision.aggregate).toHaveBeenCalledTimes(1);
      const pipeline = Decision.aggregate.mock.calls[0][0];
      const facet = pipeline.find((stage) => stage.$facet);
      expect(facet.$facet.data[0]).toEqual({ $skip: 10 });
      expect(facet.$facet.data[1]).toEqual({ $limit: 10 });

      expect(result.memories).toHaveLength(2);
      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasMore: true,
      });
    });

    it("queries ActionItem when type is action-item", async () => {
      ActionItem.aggregate.mockResolvedValue([
        {
          metadata: [{ total: 2 }],
          data: [{ _id: "a1", type: "action-item" }],
        },
      ]);

      const result = await getArchivedMemoriesPage({
        organization: "507f1f77bcf86cd799439011",
        type: "action-item",
        page: 1,
        limit: 10,
      });

      expect(ActionItem.aggregate).toHaveBeenCalled();
      expect(Decision.aggregate).not.toHaveBeenCalled();
      expect(result.pagination.total).toBe(2);
    });

    it("rejects an invalid type", async () => {
      await expect(
        getArchivedMemoriesPage({
          organization: "507f1f77bcf86cd799439011",
          type: "notes",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects a missing organization", async () => {
      await expect(
        getArchivedMemoriesPage({ type: "all" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
