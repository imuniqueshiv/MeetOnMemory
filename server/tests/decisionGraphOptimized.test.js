import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDecisionGraph } from "../controllers/decisionGraphController.js";
import Decision from "../models/decisionModel.js";

vi.mock("../models/decisionModel.js", () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe("Decision Graph Optimization (#834)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated decision graph nodes and edges", async () => {
    const req = {
      user: { organization: "org123" },
      query: { page: "1", limit: "10" },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    Decision.countDocuments.mockResolvedValue(25);

    const mockDecisions = [
      {
        _id: "d1",
        text: "Decision 1",
        owner: "user1",
        status: "resolved",
        importanceScore: 85,
        relatesTo: [{ target: "d2", confidence: 90 }],
        lifecycleState: "active",
      },
      {
        _id: "d2",
        text: "Decision 2",
        owner: "user2",
        status: "open",
        importanceScore: 70,
        lifecycleState: "active",
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockDecisions),
    };

    Decision.find.mockReturnValue(chain);

    await getDecisionGraph(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
        pagination: {
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3,
          hasMore: true,
        },
      }),
    );

    const callArgs = res.json.mock.calls[0][0];
    expect(callArgs.nodes).toHaveLength(2);
    expect(callArgs.edges).toHaveLength(1);
    expect(callArgs.edges[0]).toEqual({
      source: "d1",
      target: "d2",
      type: "relatesTo",
      confidence: 90,
    });
  });
});
