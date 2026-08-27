import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/memoryAnalyticsTelemetryService.js", () => ({
  getEnterpriseMemoryTelemetry: vi.fn(),
}));

import { getEnterpriseMemoryTelemetry } from "../services/memoryAnalyticsTelemetryService.js";
import { getEnterpriseMemoryTelemetryController } from "../controllers/memoryAnalyticsTelemetryController.js";
import knowledgeRoutes from "../routes/knowledgeRoutes.js";

describe("memoryAnalyticsTelemetryController & Route Wiring", () => {
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
    await getEnterpriseMemoryTelemetryController(req, res);

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
    await getEnterpriseMemoryTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid timeframe/),
      }),
    );
  });

  it("returns 200 OK with valid telemetry payload for authenticated organization", async () => {
    req.query.timeframe = "30d";
    const mockTelemetryData = {
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
      summary: { totalMemories: 10 },
      lifecycleDistribution: { active: 8, dormant: 2, archived: 0, expired: 0 },
    };

    getEnterpriseMemoryTelemetry.mockResolvedValue(mockTelemetryData);

    await getEnterpriseMemoryTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        telemetry: mockTelemetryData,
      }),
    );
    expect(getEnterpriseMemoryTelemetry).toHaveBeenCalledWith({
      organizationId: "507f1f77bcf86cd799439011",
      timeframe: "30d",
    });
  });

  it("returns 500 Server Error if service throws an exception", async () => {
    getEnterpriseMemoryTelemetry.mockRejectedValue(
      new Error("Database aggregation failed"),
    );

    await getEnterpriseMemoryTelemetryController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Database aggregation failed",
      }),
    );
  });

  it("registers GET /analytics/telemetry route on knowledgeRoutes", () => {
    const routeLayers = (knowledgeRoutes.stack || []).filter(
      (layer) => layer.route,
    );
    const telemetryRoute = routeLayers.find(
      (layer) => layer.route.path === "/analytics/telemetry",
    );

    expect(telemetryRoute).toBeDefined();
    expect(telemetryRoute.route.methods.get).toBe(true);
  });
});
