import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/enterpriseCostResourceEngineService.js", () => ({
  getEnterpriseCostResourceEngineMetrics: vi.fn(),
}));

import { getEnterpriseCostResourceEngineMetrics } from "../services/enterpriseCostResourceEngineService.js";
import { getEnterpriseCostResourceEngineController } from "../controllers/enterpriseCostResourceEngineController.js";
import meetingCostRoutes from "../routes/meetingCostRoutes.js";

describe("enterpriseCostResourceEngineController & Route Wiring", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      organization: { _id: "507f1f77bcf86cd799439011" },
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("returns 400 Bad Request if organization context is missing", async () => {
    req.organization = null;
    await getEnterpriseCostResourceEngineController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Organization context is required",
      }),
    );
  });

  it("returns 400 Bad Request if invalid timeframe parameter is provided", async () => {
    req.query.timeframe = "invalid_tf";
    await getEnterpriseCostResourceEngineController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid timeframe/),
      }),
    );
  });

  it("returns 200 OK with valid cost engine metrics payload", async () => {
    req.query.timeframe = "30d";
    const mockTelemetry = {
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
      summary: { totalFinancialInvestment: 1200, meetingWasteScore: 15 },
      efficiencyMetrics: { costPerDecision: 150, costPerActionItem: 75 },
    };

    getEnterpriseCostResourceEngineMetrics.mockResolvedValue(mockTelemetry);

    await getEnterpriseCostResourceEngineController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        telemetry: mockTelemetry,
      }),
    );
    expect(getEnterpriseCostResourceEngineMetrics).toHaveBeenCalledWith({
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
    });
  });

  it("returns 500 Server Error if service throws an exception", async () => {
    getEnterpriseCostResourceEngineMetrics.mockRejectedValue(
      new Error("Database calculation error"),
    );

    await getEnterpriseCostResourceEngineController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Database calculation error",
      }),
    );
  });

  it("registers GET /enterprise-engine route on meetingCostRoutes", () => {
    const routeLayers = (meetingCostRoutes.stack || []).filter(
      (layer) => layer.route,
    );
    const engineRoute = routeLayers.find(
      (layer) => layer.route.path === "/enterprise-engine",
    );

    expect(engineRoute).toBeDefined();
    expect(engineRoute.route.methods.get).toBe(true);
  });
});
