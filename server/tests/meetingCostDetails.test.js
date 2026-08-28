import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockMeetingFindById = jest.fn();
const mockConfigFindOne = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

jest.unstable_mockModule("../models/meetingCostConfigModel.js", () => ({
  default: {
    findOne: (...args) => mockConfigFindOne(...args),
  },
  setMemberRateOverrides: jest.fn(),
}));

jest.unstable_mockModule("../services/meetingCostService.js", () => ({
  default: {
    getCostAnalytics: jest.fn(),
    getMemberTimeStats: jest.fn(),
  },
}));

const { getMeetingCostDetails } =
  await import("../controllers/meetingCostController.js");

describe("Meeting Cost Details Controller (#2427)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates meeting total cost, cost per decision, and budget threshold", async () => {
    const mockMeeting = {
      _id: "m_1",
      duration: 60, // 1 hour
      participants: [{ user: "u_1" }, { user: "u_2" }], // 2 participants
      structuredMoM: {
        decisions: [{ decision: "Adopt TypeScript" }],
        action_items: [{ task: "Refactor backend" }, { task: "Update client" }],
      },
    };

    mockMeetingFindById.mockResolvedValue(mockMeeting);
    mockConfigFindOne.mockResolvedValue({
      defaultHourlyRate: 100,
      currency: "USD",
      includePreparationTime: false,
    });

    const req = {
      params: { meetingId: "m_1" },
      user: { organization: "org_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getMeetingCostDetails(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalCost: 200, // 2 participants * 1 hour * 100
          costPerDecision: 200,
          costPerActionItem: 100,
          isBudgetExceeded: false,
        }),
      }),
    );
  });
});
