import { jest } from "@jest/globals";
import mongoose from "mongoose";
import ReportTemplate from "../models/reportTemplateModel.js";
import { generateReport } from "../services/reportGeneratorService.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";

// Remove jest.mock for models

describe("reportGeneratorService", () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockUser = { _id: mockUserId, currentOrganization: mockOrgId };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw error if template is not found", async () => {
    jest.spyOn(ReportTemplate, "findById").mockResolvedValue(null);

    await expect(
      generateReport("some-id", {}, mockUser, mockOrgId),
    ).rejects.toThrow("Report Template not found");
  });

  it("should throw error if user does not have permission", async () => {
    const template = {
      _id: "template-1",
      createdBy: new mongoose.Types.ObjectId(), // Different user
      organization: mockOrgId,
      isShared: false,
    };
    jest.spyOn(ReportTemplate, "findById").mockResolvedValue(template);

    await expect(
      generateReport("template-1", {}, mockUser, mockOrgId),
    ).rejects.toThrow(
      "You do not have permission to view this report template.",
    );
  });

  it("should throw error if organization mismatch", async () => {
    const template = {
      _id: "template-2",
      createdBy: mockUserId,
      organization: new mongoose.Types.ObjectId(), // Different org
      isShared: true,
    };
    jest.spyOn(ReportTemplate, "findById").mockResolvedValue(template);

    await expect(
      generateReport("template-2", {}, mockUser, mockOrgId),
    ).rejects.toThrow("Report Template not found in your organization.");
  });

  it("should generate report data successfully", async () => {
    const template = {
      _id: "template-3",
      name: "Test Template",
      description: "Desc",
      createdBy: mockUserId,
      organization: mockOrgId,
      isShared: true,
      defaultFilters: {
        dateRangeDays: 30,
        tags: [],
        meetingTypes: [],
      },
      sections: [
        {
          _id: "sec-1",
          type: "ACTION_ITEMS",
          title: "Actions",
          order: 0,
        },
      ],
      generationCount: 0,
      save: jest.fn(),
    };

    jest.spyOn(ReportTemplate, "findById").mockResolvedValue(template);

    const mockMeetings = [
      {
        _id: new mongoose.Types.ObjectId(),
        date: new Date(),
        title: "Meeting 1",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        date: new Date(),
        title: "Meeting 2",
      },
    ];

    // Mock the chain for Meeting.find
    jest.spyOn(Meeting, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMeetings),
      }),
    });

    const mockActionItems = [
      {
        text: "Do something",
        owner: "Alice",
        status: "open",
        sourceMeetingId: mockMeetings[0],
      },
    ];

    // Mock the chain for ActionItem.find
    jest.spyOn(ActionItem, "find").mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockActionItems),
      }),
    });

    const result = await generateReport(
      "template-3",
      {},
      mockUser,
      mockOrgId.toString(),
    );

    expect(template.save).toHaveBeenCalled();
    expect(result.templateName).toBe("Test Template");
    expect(result.meetingCount).toBe(2);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].type).toBe("ACTION_ITEMS");
    expect(result.sections[0].data[0].text).toBe("Do something");
    expect(result.sections[0].data[0].owner).toBe("Alice");
  });
});
