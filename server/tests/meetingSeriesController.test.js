import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import MeetingSeries from "../models/meetingSeriesModel.js";
import User from "../models/userModel.js";
import { getSeriesMeetings } from "../controllers/meetingSeriesController.js";

describe("controllers/meetingSeriesController (Issue #915)", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });

  it("fetches all meetings in a series when limit=0 is requested", async () => {
    const owner = await User.create({
      name: "Series Owner",
      email: `owner-${new mongoose.Types.ObjectId()}@example.com`,
      password: "hashedpw123",
    });

    const series = await MeetingSeries.create({
      title: "Weekly Sync Series",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      time: "10:00 AM",
      recurrencePattern: "weekly",
      createdBy: owner._id,
    });

    // Create 105 meetings in the series
    const meetingsToCreate = [];
    for (let i = 1; i <= 105; i++) {
      meetingsToCreate.push({
        title: `Weekly Sync #${i}`,
        transcript: `Transcript for meeting ${i}`,
        uploadedBy: owner._id,
        series: series._id,
        seriesOccurrence: i,
        date: new Date(),
      });
    }
    await Meeting.insertMany(meetingsToCreate);

    const req = {
      params: { id: series._id.toString() },
      query: { limit: "0", page: "1" },
      user: { _id: owner._id },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSeriesMeetings(req, res);

    expect(res.json).toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];

    expect(responsePayload.success).toBe(true);
    expect(responsePayload.meetings.length).toBe(105);
    expect(responsePayload.pagination.total).toBe(105);
    expect(responsePayload.meetings[0].seriesOccurrence).toBe(1);
    expect(responsePayload.meetings[104].seriesOccurrence).toBe(105);
  });
});
