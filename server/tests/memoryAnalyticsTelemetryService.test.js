import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/decisionModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { getEnterpriseMemoryTelemetry } from "../services/memoryAnalyticsTelemetryService.js";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("memoryAnalyticsTelemetryService", () => {
  let organizationId;

  beforeEach(() => {
    vi.clearAllMocks();
    organizationId = makeObjectId();
  });

  it("throws an error if organizationId is missing or invalid", async () => {
    await expect(
      getEnterpriseMemoryTelemetry({ organizationId: null }),
    ).rejects.toThrow("Valid organizationId is required");

    await expect(
      getEnterpriseMemoryTelemetry({ organizationId: "invalid-id" }),
    ).rejects.toThrow("Valid organizationId is required");
  });

  it("returns zeroed telemetry structure when organization has no memories", async () => {
    Decision.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const result = await getEnterpriseMemoryTelemetry({ organizationId });

    expect(result.organizationId).toBe(organizationId.toString());
    expect(result.summary.totalMemories).toBe(0);
    expect(result.summary.decisionsCount).toBe(0);
    expect(result.summary.actionItemsCount).toBe(0);
    expect(result.lifecycleDistribution).toEqual({
      active: 0,
      dormant: 0,
      archived: 0,
      expired: 0,
    });
    expect(result.importanceMetrics.averageScore).toBe(0);
    expect(result.recommendations).toHaveLength(1);
  });

  it("correctly aggregates lifecycle distribution, importance, and velocity metrics", async () => {
    const decisionsMock = [
      {
        _id: makeObjectId(),
        text: "Active High Importance Decision",
        organization: organizationId,
        lifecycleState: "active",
        importanceScore: 85,
        accessCount: 12,
        lastAccessedAt: daysAgo(2),
        createdAt: daysAgo(5),
      },
      {
        _id: makeObjectId(),
        text: "Dormant Decision",
        organization: organizationId,
        lifecycleState: "dormant",
        importanceScore: 45,
        accessCount: 3,
        lastAccessedAt: daysAgo(40),
        createdAt: daysAgo(50),
        mergedFrom: [{ originalId: makeObjectId(), text: "Merged phrasing" }],
        lifecycleHistory: [{ from: "active", to: "dormant", reason: "sweep" }],
      },
    ];

    const actionItemsMock = [
      {
        _id: makeObjectId(),
        text: "Archived Action Item",
        organization: organizationId,
        lifecycleState: "archived",
        importanceScore: 20,
        accessCount: 1,
        lastAccessedAt: daysAgo(100),
        createdAt: daysAgo(120),
      },
      {
        _id: makeObjectId(),
        text: "Expired Action Item",
        organization: organizationId,
        lifecycleState: "expired",
        importanceScore: 10,
        accessCount: 0,
        createdAt: daysAgo(400),
      },
    ];

    Decision.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(decisionsMock),
    });
    ActionItem.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(actionItemsMock),
    });

    const telemetry = await getEnterpriseMemoryTelemetry({
      organizationId,
      timeframe: "30d",
    });

    expect(telemetry.summary.totalMemories).toBe(4);
    expect(telemetry.summary.decisionsCount).toBe(2);
    expect(telemetry.summary.actionItemsCount).toBe(2);

    expect(telemetry.lifecycleDistribution).toEqual({
      active: 1,
      dormant: 1,
      archived: 1,
      expired: 1,
    });

    expect(telemetry.importanceMetrics.protectedCount).toBe(1);
    expect(telemetry.importanceMetrics.distribution).toEqual({
      high: 1,
      medium: 1,
      low: 2,
    });

    expect(telemetry.velocityMetrics.totalAccesses).toBe(16);
    expect(telemetry.velocityMetrics.createdInTimeframe).toBe(1);
    expect(telemetry.velocityMetrics.accessedInTimeframe).toBe(1);
    expect(telemetry.consolidationMetrics.mergedMemoriesCount).toBe(1);
    expect(telemetry.consolidationMetrics.totalTransitionsLogged).toBe(1);
  });

  it("handles timeframe 'all' correctly", async () => {
    Decision.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: makeObjectId(),
          createdAt: daysAgo(200),
          lastAccessedAt: daysAgo(100),
        },
      ]),
    });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const telemetry = await getEnterpriseMemoryTelemetry({
      organizationId,
      timeframe: "all",
    });

    expect(telemetry.velocityMetrics.createdInTimeframe).toBe(1);
    expect(telemetry.velocityMetrics.accessedInTimeframe).toBe(1);
  });
});
