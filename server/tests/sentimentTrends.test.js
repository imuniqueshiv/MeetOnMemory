import { jest } from "@jest/globals";
import express from "express";
import mongoose from "mongoose";
import request from "supertest";

const testUserId = new mongoose.Types.ObjectId();
let testOrgId = new mongoose.Types.ObjectId();

let currentUser = {
  _id: testUserId,
  role: "owner",
  organization: testOrgId,
};

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    req.user = currentUser;
    next();
  },
}));

const { default: sentimentTimelineRoutes } =
  await import("../routes/sentimentTimelineRoutes.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: SentimentTimeline } =
  await import("../models/sentimentTimelineModel.js");
const { default: Organization } =
  await import("../models/organizationModel.js");
const { default: User } = await import("../models/userModel.js");

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/sentiment-timeline", sentimentTimelineRoutes);
});

describe("Organization Sentiment Trends (#2039)", () => {
  let org;
  let meeting1;
  let meeting2;

  beforeEach(async () => {
    await Meeting.deleteMany({});
    await SentimentTimeline.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    org = await Organization.create({
      _id: testOrgId,
      name: "Trend Analytics Org",
      domain: "trendorg.com",
      owner: testUserId,
      slug: "trend-analytics-org",
    });

    meeting1 = await Meeting.create({
      title: "Sprint Planning A",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      uploadedBy: testUserId,
      organization: org._id,
      duration: 30,
    });

    meeting2 = await Meeting.create({
      title: "Design Sync B",
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      uploadedBy: testUserId,
      organization: org._id,
      duration: 45,
    });

    await SentimentTimeline.create({
      meeting: meeting1._id,
      organization: org._id,
      status: "completed",
      overallArc: "Steady engagement with high positive consensus.",
      segments: [
        {
          startTime: 0,
          endTime: 120000,
          sentiment: "positive",
          score: 0.6,
          textSnippet: "Great progress on our milestones!",
        },
        {
          startTime: 120000,
          endTime: 240000,
          sentiment: "positive",
          score: 0.8,
          textSnippet: "Everyone loved the new prototype.",
        },
      ],
    });

    await SentimentTimeline.create({
      meeting: meeting2._id,
      organization: org._id,
      status: "completed",
      overallArc: "Challenging blockers identified early on.",
      segments: [
        {
          startTime: 0,
          endTime: 120000,
          sentiment: "negative",
          score: -0.4,
          textSnippet: "We encountered an unexpected regression.",
        },
        {
          startTime: 120000,
          endTime: 240000,
          sentiment: "neutral",
          score: 0.0,
          textSnippet: "Let's investigate the log files.",
        },
      ],
    });
  });

  afterAll(async () => {
    await Meeting.deleteMany({});
    await SentimentTimeline.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});
  });

  it("fetches organization sentiment trends successfully", async () => {
    const res = await request(app)
      .get(`/api/sentiment-timeline/organization/${org._id}/trends?days=30`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.totalMeetingsAnalyzed).toBe(2);
    expect(res.body.data.summary.totalSegmentsAnalyzed).toBe(4);
    expect(res.body.data.timeline.length).toBe(2);

    expect(res.body.data.highlights.mostPositiveMeeting).toBeDefined();
    expect(res.body.data.highlights.mostPositiveMeeting.title).toBe(
      "Sprint Planning A",
    );
  });

  it("returns 400 for invalid organization ID", async () => {
    const res = await request(app)
      .get("/api/sentiment-timeline/organization/invalid-id/trends")
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Invalid organization ID format");
  });
});
