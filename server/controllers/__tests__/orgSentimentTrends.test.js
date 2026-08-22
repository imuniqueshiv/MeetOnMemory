import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { getOrgSentimentTrends } from "../sentimentTimelineController.js";
import Meeting from "../../models/meetingModel.js";
import SentimentTimeline from "../../models/sentimentTimelineModel.js";

vi.mock("../../models/meetingModel.js");
vi.mock("../../models/sentimentTimelineModel.js");
vi.mock("../../services/sentimentTimelineService.js");

describe("Organization Sentiment Trends Controller (#2039)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validOrgId = new mongoose.Types.ObjectId().toString();
  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    organization: validOrgId,
    role: "member",
  };

  const createMockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it("returns 400 when orgId format is invalid", async () => {
    const req = { params: { orgId: "invalid-id" }, query: {}, user: mockUser };
    const res = createMockRes();

    await getOrgSentimentTrends(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid organization ID format",
      }),
    );
  });

  it("returns 403 when user belongs to a different organization and is not admin", async () => {
    const diffOrgId = new mongoose.Types.ObjectId().toString();
    const req = { params: { orgId: diffOrgId }, query: {}, user: mockUser };
    const res = createMockRes();

    await getOrgSentimentTrends(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message:
          "Forbidden: You don't have access to this organization's sentiment trends",
      }),
    );
  });

  it("successfully aggregates organization sentiment trends", async () => {
    const mId1 = new mongoose.Types.ObjectId();
    const mId2 = new mongoose.Types.ObjectId();

    Meeting.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: mId1, title: "Sprint Planning", createdAt: new Date() },
          { _id: mId2, title: "Product Retro", createdAt: new Date() },
        ]),
      }),
    });

    SentimentTimeline.find.mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([
          {
            meeting: mId1,
            averageScore: 0.85,
            dataPoints: [{ sentimentScore: 0.85 }],
          },
        ]),
    });

    const req = {
      params: { orgId: validOrgId },
      query: { range: "30d" },
      user: mockUser,
    };
    const res = createMockRes();

    await getOrgSentimentTrends(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalMeetings: 2,
          analyzedMeetings: 1,
          overallAverageScore: 0.85,
        }),
      }),
    );
  });
});
