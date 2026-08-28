import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock models and utils
const mockTagFindOne = jest.fn();
const mockTagFind = jest.fn();
const mockTagCreate = jest.fn();
const mockTagDeleteOne = jest.fn();
const mockMeetingFind = jest.fn();
const mockMeetingCount = jest.fn();

jest.unstable_mockModule("../models/tagModel.js", () => ({
  default: {
    findOne: (...args) => mockTagFindOne(...args),
    find: (...args) => mockTagFind(...args),
    create: (...args) => mockTagCreate(...args),
    deleteOne: (...args) => mockTagDeleteOne(...args),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    find: (...args) => mockMeetingFind(...args),
    countDocuments: (...args) => mockMeetingCount(...args),
  },
}));

const { mergeTags, exportTags } =
  await import("../controllers/tagController.js");

describe("Tag Taxonomy Administration Controllers (#2244)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("merges source tag into target tag and cleans up source tag", async () => {
    const sourceTag = {
      _id: { equals: () => false, toString: () => "src_1" },
      name: "OldArch",
      organization: "org_1",
    };
    const targetTag = {
      _id: { equals: () => false, toString: () => "tgt_1" },
      name: "NewArch",
      organization: "org_1",
      usageCount: 0,
      save: jest.fn(),
    };

    mockTagFindOne
      .mockImplementationOnce(() => ({
        collation: () => Promise.resolve(sourceTag),
      }))
      .mockImplementationOnce(() => ({
        collation: () => Promise.resolve(targetTag),
      }));

    const mockMeeting = {
      tags: ["OldArch", "Design"],
      save: jest.fn(),
    };
    mockMeetingFind.mockResolvedValue([mockMeeting]);
    mockMeetingCount.mockResolvedValue(1);

    const req = {
      user: { organization: "org_1", _id: "user_1" },
      body: { sourceName: "OldArch", targetName: "NewArch" },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await mergeTags(req, res, next);

    expect(mockMeeting.tags).toEqual(["Design", "NewArch"]);
    expect(mockMeeting.save).toHaveBeenCalled();
    expect(mockTagDeleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("exports taxonomy as CSV format with proper headers", async () => {
    mockTagFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          name: "Backend",
          color: "#3B82F6",
          usageCount: 4,
          description: "Server code",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ]),
    });

    const req = { user: { organization: "org_1" } };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    await exportTags(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/csv; charset=utf-8",
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('"Backend","#3B82F6",4,"Server code"'),
    );
  });
});
