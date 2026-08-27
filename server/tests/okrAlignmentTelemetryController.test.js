import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/okrAlignmentTelemetryService.js", () => ({
  getEnterpriseOkrAlignmentTelemetry: vi.fn(),
}));

import { getEnterpriseOkrAlignmentTelemetry } from "../services/okrAlignmentTelemetryService.js";
import { getEnterpriseOkrAlignmentTelemetryController } from "../controllers/okrAlignmentTelemetryController.js";
import knowledgeRoutes from "../routes/knowledgeRoutes.js";

describe("okrAlignmentTelemetryController & Route Wiring", () => {
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
    await getEnterpriseOkrAlignmentTelemetryController(req, res);

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
    await getEnterpriseOkrAlignmentTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid timeframe/),
      }),
    );
  });

  it("returns 200 OK with valid OKR telemetry payload for authenticated organization", async () => {
    req.query.timeframe = "30d";
    const mockTelemetryData = {
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
      summary: { totalObjectives: 5, overallAlignmentScore: 92 },
      objectiveStatusBreakdown: {
        on_track: 4,
        at_risk: 1,
        behind: 0,
        achieved: 0,
      },
    };

    getEnterpriseOkrAlignmentTelemetry.mockResolvedValue(mockTelemetryData);

    await getEnterpriseOkrAlignmentTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        telemetry: mockTelemetryData,
      }),
    );
    expect(getEnterpriseOkrAlignmentTelemetry).toHaveBeenCalledWith({
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
    });
  });

  it("returns 500 Server Error if service throws an exception", async () => {
    getEnterpriseOkrAlignmentTelemetry.mockRejectedValue(
      new Error("OKR aggregation failed"),
    );

    await getEnterpriseOkrAlignmentTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "OKR aggregation failed",
      }),
    );
  });

  it("registers GET /analytics/okr-alignment route on knowledgeRoutes", () => {
    const routeLayers = (knowledgeRoutes.stack || []).filter(
      (layer) => layer.route,
    );
    const okrRoute = routeLayers.find(
      (layer) => layer.route.path === "/analytics/okr-alignment",
    );

    expect(okrRoute).toBeDefined();
    expect(okrRoute.route.methods.get).toBe(true);
  });
});
