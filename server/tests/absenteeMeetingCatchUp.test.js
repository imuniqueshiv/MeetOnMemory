import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockAbsenteeFindOne = jest.fn();
const mockAbsenteeFindOneAndUpdate = jest.fn();
const mockMeetingFindById = jest.fn();
const mockGenerateAbsenteeCatchUpAI = jest.fn();

jest.unstable_mockModule("../models/absenteeCatchUpModel.js", () => ({
  default: {
    findOne: (...args) => mockAbsenteeFindOne(...args),
    findOneAndUpdate: (...args) => mockAbsenteeFindOneAndUpdate(...args),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateAbsenteeCatchUpAI: (...args) =>
    mockGenerateAbsenteeCatchUpAI(...args),
}));

jest.unstable_mockModule("../services/absenteeCatchUpService.js", () => ({
  default: {
    getPendingCatchUps: jest.fn(),
    markAsRead: jest.fn(),
    deliverCatchUp: jest.fn(),
  },
}));

const { getMeetingCatchUp, generateMeetingCatchUp } =
  await import("../controllers/absenteeCatchUpController.js");

describe("Absentee Meeting Catch-Up Endpoints (#2423)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches meeting catch-up for authenticated user", async () => {
    const mockCatchUp = {
      _id: "catchup_1",
      meetingId: "m_1",
      userId: "u_1",
      content: { overview: "Summary overview" },
    };

    mockAbsenteeFindOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCatchUp),
    });

    const req = {
      user: { _id: "u_1" },
      params: { meetingId: "m_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getMeetingCatchUp(req, res);

    expect(mockAbsenteeFindOne).toHaveBeenCalledWith({
      meetingId: "m_1",
      userId: "u_1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      catchUp: mockCatchUp,
    });
  });

  it("generates and upserts personalized meeting catch-up briefing", async () => {
    const mockMeeting = {
      _id: "m_1",
      title: "Sprint Planning",
      date: new Date(),
      summary: "Planned sprint backlog",
      structuredMoM: {
        decisions: ["Adopt Next.js"],
        action_items: [{ task: "Setup repository" }],
      },
    };

    mockMeetingFindById.mockResolvedValue(mockMeeting);
    mockGenerateAbsenteeCatchUpAI.mockResolvedValue({
      overview: "Sprint planning overview",
      actionItems: ["Setup repository"],
      decisions: ["Adopt Next.js"],
      mentions: [],
    });

    const mockSavedCatchUp = {
      _id: "catchup_new",
      meetingId: "m_1",
      userId: "u_1",
      content: { overview: "Sprint planning overview" },
      status: "pending",
    };

    mockAbsenteeFindOneAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockSavedCatchUp),
    });

    const req = {
      user: { _id: "u_1", firstName: "Alice", lastName: "Smith" },
      params: { meetingId: "m_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await generateMeetingCatchUp(req, res);

    expect(mockMeetingFindById).toHaveBeenCalledWith("m_1");
    expect(mockGenerateAbsenteeCatchUpAI).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      catchUp: mockSavedCatchUp,
    });
  });
});
