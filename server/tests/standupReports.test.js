import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockStandupReportFind = jest.fn();
const mockStandupPrefFindOne = jest.fn();
const mockStandupPrefFindOneAndUpdate = jest.fn();
const mockGenerateStandupReport = jest.fn();

jest.unstable_mockModule("../models/standupReportModel.js", () => ({
  default: {
    find: (...args) => mockStandupReportFind(...args),
  },
}));

jest.unstable_mockModule("../models/standupPreferenceModel.js", () => ({
  default: {
    findOne: (...args) => mockStandupPrefFindOne(...args),
    findOneAndUpdate: (...args) => mockStandupPrefFindOneAndUpdate(...args),
  },
}));

jest.unstable_mockModule("../services/standupReportService.js", () => ({
  generateStandupReport: (...args) => mockGenerateStandupReport(...args),
}));

const {
  getMyReports,
  generateManualReport,
  getPreferences,
  updatePreferences,
} = await import("../controllers/standupReportController.js");

describe("Standup Reports Controller (#2426)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves personal standup reports for authenticated user", async () => {
    const mockReports = [
      {
        _id: "rep_1",
        type: "daily",
        aiSummary: "Completed tests",
      },
    ];

    mockStandupReportFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockReports),
              }),
            }),
          }),
        }),
      }),
    });

    const req = {
      user: { _id: "u_1", organization: "org_1" },
      query: {},
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getMyReports(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockReports,
    });
  });

  it("triggers manual standup report synthesis", async () => {
    const mockCreated = {
      _id: "rep_2",
      type: "daily",
      aiSummary: "Generated report",
    };

    mockGenerateStandupReport.mockResolvedValue(mockCreated);

    const req = {
      user: { _id: "u_1", organization: "org_1" },
      body: { type: "daily" },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await generateManualReport(req, res);

    expect(mockGenerateStandupReport).toHaveBeenCalledWith(
      "u_1",
      "org_1",
      "daily",
      expect.any(Date),
      expect.any(Date),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockCreated,
    });
  });
});
