import { jest } from "@jest/globals";
import mongoose from "mongoose";

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

const { default: Meeting } = await import("../models/meetingModel.js");
const { addActionItem } =
  await import("../controllers/workspaceController.js");

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return res;
};

describe("addActionItem authorization (#1383)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a user who is not a meeting participant", async () => {
    const userId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const meeting = {
      participants: [],
      uploadedBy: ownerId,
      organization: new mongoose.Types.ObjectId(),
      warRoom: {
        actionColumns: {
          backlog: [],
        },
      },
      save: jest.fn(),
      markModified: jest.fn(),
    };

    Meeting.findById.mockResolvedValue(meeting);

    const req = {
      params: {
        meetingId: new mongoose.Types.ObjectId().toString(),
      },
      body: {
        title: "Unauthorized action",
      },
      user: {
        _id: userId,
        email: "user@example.com",
        organization: meeting.organization,
      },
    };

    const res = createResponse();

    await addActionItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      }),
    );
    expect(meeting.save).not.toHaveBeenCalled();
  });

  it("rejects a participant from another organization", async () => {
    const userId = new mongoose.Types.ObjectId();
    const meetingOrg = new mongoose.Types.ObjectId();
    const userOrg = new mongoose.Types.ObjectId();

    const meeting = {
      participants: [
        {
          user: userId,
          email: "user@example.com",
        },
      ],
      uploadedBy: new mongoose.Types.ObjectId(),
      organization: meetingOrg,
      warRoom: {
        actionColumns: {
          backlog: [],
        },
      },
      save: jest.fn(),
      markModified: jest.fn(),
    };

    Meeting.findById.mockResolvedValue(meeting);

    const req = {
      params: {
        meetingId: new mongoose.Types.ObjectId().toString(),
      },
      body: {
        title: "Cross organization action",
      },
      user: {
        _id: userId,
        email: "user@example.com",
        organization: userOrg,
      },
    };

    const res = createResponse();

    await addActionItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(meeting.save).not.toHaveBeenCalled();
  });

  it("allows an authorized participant from the same organization", async () => {
    const userId = new mongoose.Types.ObjectId();
    const organization = new mongoose.Types.ObjectId();

    const meeting = {
      participants: [
        {
          user: userId,
          email: "user@example.com",
        },
      ],
      uploadedBy: new mongoose.Types.ObjectId(),
      organization,
      warRoom: {
        actionColumns: {
          backlog: [],
        },
      },
      save: jest.fn(),
      markModified: jest.fn(),
    };

    Meeting.findById.mockResolvedValue(meeting);

    const req = {
      params: {
        meetingId: new mongoose.Types.ObjectId().toString(),
      },
      body: {
        title: "Authorized action",
        priority: "high",
      },
      user: {
        _id: userId,
        email: "user@example.com",
        organization,
      },
    };

    const res = createResponse();

    await addActionItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(meeting.save).toHaveBeenCalled();
    expect(meeting.warRoom.actionColumns.backlog).toHaveLength(1);
    expect(meeting.warRoom.actionColumns.backlog[0].title).toBe(
      "Authorized action",
    );
  });
});