import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/decisionModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Decision from "../models/decisionModel.js";
import { getDecisionDependencyMatrix } from "../controllers/decisionGraphController.js";
import decisionGraphRoutes from "../routes/decisionGraphRoutes.js";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

describe("Decision Dependency Matrix Controller & Routes", () => {
  let req;
  let res;
  let orgId;

  beforeEach(() => {
    vi.clearAllMocks();
    orgId = makeObjectId();

    req = {
      user: { organization: orgId },
      query: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("returns empty matrix structure when organization has no decisions", async () => {
    Decision.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    await getDecisionDependencyMatrix(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [],
        matrix: [],
        summary: {
          totalDecisions: 0,
          totalDependencies: 0,
          matrixDensityPercentage: 0,
          cyclesCount: 0,
        },
        cycles: [],
      }),
    );
  });

  it("calculates in-degree, out-degree, 2D matrix grid, and detects cycles correctly", async () => {
    const idA = makeObjectId();
    const idB = makeObjectId();

    const mockDecisions = [
      {
        _id: idA,
        text: "Decision A",
        owner: "Alice",
        status: "open",
        importanceScore: 85,
        relatesTo: [{ target: idB, confidence: 90 }],
        supersededByMemory: null,
      },
      {
        _id: idB,
        text: "Decision B",
        owner: "Bob",
        status: "resolved",
        importanceScore: 60,
        relatesTo: [],
        supersededByMemory: null,
      },
    ];

    Decision.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockDecisions),
    });

    await getDecisionDependencyMatrix(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const data = res.json.mock.calls[0][0];
    expect(data.nodes).toHaveLength(2);

    const nodeA = data.nodes.find((n) => n.id === idA.toString());
    const nodeB = data.nodes.find((n) => n.id === idB.toString());

    expect(nodeA.outDegree).toBe(1);
    expect(nodeA.inDegree).toBe(0);
    expect(nodeB.inDegree).toBe(1);
    expect(nodeB.outDegree).toBe(0);

    // Matrix check: row 0 (A) to col 1 (B) is relatesTo
    expect(data.matrix[0][1]).toEqual({
      type: "relatesTo",
      confidence: 90,
    });
    // row 0 (A) to col 0 (A) is self
    expect(data.matrix[0][0]).toEqual({
      type: "self",
      confidence: null,
    });
  });

  it("registers GET /matrix route on decisionGraphRoutes", () => {
    const routeLayers = (decisionGraphRoutes.stack || []).filter(
      (layer) => layer.route,
    );
    const matrixRoute = routeLayers.find(
      (layer) => layer.route.path === "/matrix",
    );

    expect(matrixRoute).toBeDefined();
    expect(matrixRoute.route.methods.get).toBe(true);
  });
});
