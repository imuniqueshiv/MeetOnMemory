import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/meetingModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

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

vi.mock("../models/resourceBookingModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../models/meetingCostConfigModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
  normalizeOverrideEmail: (email) =>
    email ? email.toLowerCase().trim() : null,
  readMemberRateOverrides: () => new Map(),
}));

import Meeting from "../models/meetingModel.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import ResourceBooking from "../models/resourceBookingModel.js";
import MeetingCostConfig from "../models/meetingCostConfigModel.js";
import { getEnterpriseCostResourceEngineMetrics } from "../services/enterpriseCostResourceEngineService.js";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("enterpriseCostResourceEngineService", () => {
  let organizationId;

  beforeEach(() => {
    vi.clearAllMocks();
    organizationId = makeObjectId();
    ResourceBooking.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  it("throws an error if organizationId is missing or invalid", async () => {
    await expect(
      getEnterpriseCostResourceEngineMetrics({ organizationId: null }),
    ).rejects.toThrow("Valid organizationId is required");

    await expect(
      getEnterpriseCostResourceEngineMetrics({ organizationId: "invalid-id" }),
    ).rejects.toThrow("Valid organizationId is required");
  });

  it("returns zeroed cost engine telemetry structure when organization has no meetings", async () => {
    Meeting.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    Decision.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    MeetingCostConfig.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await getEnterpriseCostResourceEngineMetrics({
      organizationId,
    });

    expect(result.organizationId).toBe(organizationId.toString());
    expect(result.summary.totalFinancialInvestment).toBe(0);
    expect(result.summary.totalMeetingsCount).toBe(0);
    expect(result.efficiencyMetrics.costPerDecision).toBe(0);
    expect(result.efficiencyMetrics.costPerActionItem).toBe(0);
    expect(result.summary.meetingWasteScore).toBe(0);
    expect(result.savingsOpportunities.recommendations).toHaveLength(1);
  });

  it("calculates labor costs, cost per decision, and waste scores accurately", async () => {
    const meetingsMock = [
      {
        _id: makeObjectId(),
        title: "Executive Strategy Sync",
        duration: 60,
        participants: [
          { email: "ceo@org.com", name: "CEO" },
          { email: "cto@org.com", name: "CTO" },
        ],
        date: daysAgo(2),
        organization: organizationId,
      },
      {
        _id: makeObjectId(),
        title: "Unguided Status Meeting",
        duration: 60,
        participants: [{ email: "dev@org.com", name: "Dev" }],
        date: daysAgo(5),
        organization: organizationId,
      },
    ];

    const decisionsMock = [
      {
        _id: makeObjectId(),
        text: "Approve Enterprise Architecture Roadmap",
        organization: organizationId,
        createdAt: daysAgo(2),
      },
    ];

    const actionItemsMock = [
      {
        _id: makeObjectId(),
        text: "Prepare Q3 Security Compliance Report",
        organization: organizationId,
        createdAt: daysAgo(2),
      },
    ];

    Meeting.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(meetingsMock),
    });
    Decision.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(decisionsMock),
    });
    ActionItem.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(actionItemsMock),
    });
    MeetingCostConfig.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        defaultHourlyRate: 100,
        currency: "USD",
      }),
    });

    const metrics = await getEnterpriseCostResourceEngineMetrics({
      organizationId,
      timeframe: "30d",
    });

    expect(metrics.summary.totalMeetingsCount).toBe(2);
    // Meeting 1: 2 participants * $100/hr * 1hr = $200
    // Meeting 2: 1 participant * $100/hr * 1hr = $100
    // Total labor cost = $300
    expect(metrics.summary.laborTimeCost).toBe(300);
    expect(metrics.summary.totalFinancialInvestment).toBe(300);

    expect(metrics.efficiencyMetrics.costPerDecision).toBe(300);
    expect(metrics.efficiencyMetrics.costPerActionItem).toBe(300);
  });

  it("handles timeframe 'all' correctly", async () => {
    Meeting.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: makeObjectId(),
          duration: 30,
          date: daysAgo(100),
        },
      ]),
    });
    Decision.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    ActionItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    MeetingCostConfig.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const metrics = await getEnterpriseCostResourceEngineMetrics({
      organizationId,
      timeframe: "all",
    });

    expect(metrics.summary.totalMeetingsCount).toBe(1);
    expect(metrics.summary.totalHoursSpent).toBe(0.5);
  });
});
