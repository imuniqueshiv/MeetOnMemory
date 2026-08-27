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

vi.mock("../models/meetingGoalModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import MeetingGoal from "../models/meetingGoalModel.js";
import { getEnterpriseOkrAlignmentTelemetry } from "../services/okrAlignmentTelemetryService.js";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("okrAlignmentTelemetryService", () => {
  let organizationId;

  beforeEach(() => {
    vi.clearAllMocks();
    organizationId = makeObjectId();
  });

  it("throws an error if organizationId is missing or invalid", async () => {
    await expect(
      getEnterpriseOkrAlignmentTelemetry({ organizationId: null }),
    ).rejects.toThrow("Valid organizationId is required");

    await expect(
      getEnterpriseOkrAlignmentTelemetry({ organizationId: "invalid-id" }),
    ).rejects.toThrow("Valid organizationId is required");
  });

  it("returns zeroed alignment telemetry structure when organization has no data", async () => {
    Decision.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    MeetingGoal.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const result = await getEnterpriseOkrAlignmentTelemetry({ organizationId });

    expect(result.organizationId).toBe(organizationId.toString());
    expect(result.summary.totalObjectives).toBe(0);
    expect(result.summary.activeKeyResults).toBe(0);
    expect(result.summary.overallAlignmentScore).toBe(100);
    expect(result.objectiveStatusBreakdown).toEqual({
      on_track: 0,
      at_risk: 0,
      behind: 0,
      achieved: 0,
    });
    expect(result.recommendations).toHaveLength(1);
  });

  it("aggregates OKR objective status, pillar distribution, and misalignment metrics correctly", async () => {
    const decisionsMock = [
      {
        _id: makeObjectId(),
        text: "Launch Product Excellence feature branch",
        organization: organizationId,
        importanceScore: 80,
        status: "resolved",
        createdAt: daysAgo(5),
      },
      {
        _id: makeObjectId(),
        text: "Customer growth pricing tier revision",
        organization: organizationId,
        importanceScore: 30,
        status: "open",
        createdAt: daysAgo(10),
      },
    ];

    const actionItemsMock = [
      {
        _id: makeObjectId(),
        text: "Fix security compliance audit logs",
        organization: organizationId,
        importanceScore: 75,
        status: "completed",
        createdAt: daysAgo(2),
      },
    ];

    const meetingGoalsMock = [
      {
        _id: makeObjectId(),
        organization: organizationId,
        goals: [
          { text: "Achieve 99.9% API Uptime", status: "achieved" },
          {
            text: "Reduce Customer Onboarding friction",
            status: "partially_achieved",
          },
          { text: "Fix zero-day vulnerability", status: "not_achieved" },
        ],
        createdAt: daysAgo(3),
      },
    ];

    Decision.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(decisionsMock),
    });
    ActionItem.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(actionItemsMock),
    });
    MeetingGoal.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(meetingGoalsMock),
    });

    const telemetry = await getEnterpriseOkrAlignmentTelemetry({
      organizationId,
      timeframe: "30d",
    });

    expect(telemetry.summary.totalObjectives).toBe(3);
    expect(telemetry.summary.activeKeyResults).toBe(3);
    expect(telemetry.objectiveStatusBreakdown.achieved).toBe(1);
    expect(telemetry.objectiveStatusBreakdown.on_track).toBe(1);
    expect(telemetry.objectiveStatusBreakdown.at_risk).toBe(1);
    expect(telemetry.pillarDistribution).toHaveLength(5);
    expect(telemetry.misalignmentDiagnostics.unalignedTotal).toBe(1);
  });

  it("handles timeframe 'all' correctly", async () => {
    Decision.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: makeObjectId(),
          text: "Legacy Decision",
          createdAt: daysAgo(200),
          importanceScore: 75,
        },
      ]),
    });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    MeetingGoal.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const telemetry = await getEnterpriseOkrAlignmentTelemetry({
      organizationId,
      timeframe: "all",
    });

    expect(telemetry.summary.activeKeyResults).toBe(1);
  });
});
