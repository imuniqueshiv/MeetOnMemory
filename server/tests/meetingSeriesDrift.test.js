import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import MeetingSeries from "../models/meetingSeriesModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import User from "../models/userModel.js";
import { getSeriesDrift } from "../controllers/meetingSeriesController.js";

describe("controllers/meetingSeriesController - getSeriesDrift (Issue #2170)", () => {
  let owner;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await MeetingSeries.deleteMany({});
    await Meeting.deleteMany({});
    await ActionItem.deleteMany({});
    await Decision.deleteMany({});

    owner = await User.create({
      name: "Drift Owner",
      email: `drift-${new mongoose.Types.ObjectId()}@example.com`,
      password: "hashedpw123",
    });
  });

  it("calculates drift analytics correctly for a valid series", async () => {
    const series = await MeetingSeries.create({
      title: "Monthly Strategy Sync",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      time: "10:00 AM",
      recurrencePattern: "monthly",
      createdBy: owner._id,
    });

    // Create 3 meetings
    const m1 = await Meeting.create({
      title: `Monthly Sync #1`,
      uploadedBy: owner._id,
      series: series._id,
      seriesOccurrence: 1,
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: "completed",
      duration: 60,
      participants: [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
    });

    const m2 = await Meeting.create({
      title: `Monthly Sync #2`,
      uploadedBy: owner._id,
      series: series._id,
      seriesOccurrence: 2,
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      status: "completed",
      duration: 50,
      participants: [{ name: "Alice" }, { name: "Bob" }],
    });

    const m3 = await Meeting.create({
      title: `Monthly Sync #3`,
      uploadedBy: owner._id,
      series: series._id,
      seriesOccurrence: 3,
      date: new Date(),
      status: "completed",
      duration: 45,
      participants: [{ name: "Alice" }],
    });

    // Create Action Items
    // M1: 2 action items
    await ActionItem.create({ text: "AI 1", sourceMeetingId: m1._id });
    await ActionItem.create({ text: "AI 2", sourceMeetingId: m1._id });
    // M2: 1 action item
    await ActionItem.create({ text: "AI 3", sourceMeetingId: m2._id });
    // M3: 0 action items

    // Create Decisions
    // M1: 1 decision
    await Decision.create({ text: "Dec 1", sourceMeetingId: m1._id });
    // M2: 0 decisions
    // M3: 3 decisions
    await Decision.create({ text: "Dec 2", sourceMeetingId: m3._id });
    await Decision.create({ text: "Dec 3", sourceMeetingId: m3._id });
    await Decision.create({ text: "Dec 4", sourceMeetingId: m3._id });

    const req = {
      params: { id: series._id.toString() },
      user: { _id: owner._id }, // No organization test
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSeriesDrift(req, res);

    expect(res.json).toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];

    expect(responsePayload.success).toBe(true);
    expect(responsePayload.drift.length).toBe(3);

    // First meeting (M1)
    expect(responsePayload.drift[0].duration).toBe(60);
    expect(responsePayload.drift[0].attendanceCount).toBe(3);
    expect(responsePayload.drift[0].actionItemCount).toBe(2);
    expect(responsePayload.drift[0].decisionCount).toBe(1);

    // Third meeting (M3)
    expect(responsePayload.drift[2].duration).toBe(45);
    expect(responsePayload.drift[2].attendanceCount).toBe(1);
    expect(responsePayload.drift[2].actionItemCount).toBe(0);
    expect(responsePayload.drift[2].decisionCount).toBe(3);

    // Check summary (M3 - M1)
    expect(responsePayload.summary.durationChange).toBe(-15);
    expect(responsePayload.summary.attendanceChange).toBe(-2);
    expect(responsePayload.summary.actionItemChange).toBe(-2);
    expect(responsePayload.summary.decisionChange).toBe(2);
  });

  it("returns 404 for cross-organization access", async () => {
    const series = await MeetingSeries.create({
      title: "Other Org Series",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      time: "10:00 AM",
      recurrencePattern: "monthly",
      createdBy: owner._id,
      organization: new mongoose.Types.ObjectId(), // Belongs to different org
    });

    const req = {
      params: { id: series._id.toString() },
      user: { _id: owner._id, organization: new mongoose.Types.ObjectId() }, // Requesting org mismatch
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSeriesDrift(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 for nonexistent series", async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: owner._id, organization: new mongoose.Types.ObjectId() },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSeriesDrift(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 400 for invalid series ID", async () => {
    const req = {
      params: { id: "invalid-id" },
      user: { _id: owner._id },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSeriesDrift(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
