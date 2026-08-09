import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import MeetingFeedback from "../models/meetingFeedbackModel.js";
import MeetingHealth from "../models/meetingHealthModel.js";
import { calculateMeetingHealth } from "../services/meetingHealthService.js";
import { jest } from "@jest/globals";

describe("Meeting Health Service", () => {
  let mockMeeting;
  let orgId;
  let userId;

  beforeEach(() => {
    jest.clearAllMocks();

    orgId = new mongoose.Types.ObjectId().toString();
    userId = new mongoose.Types.ObjectId().toString();

    mockMeeting = {
      _id: new mongoose.Types.ObjectId().toString(),
      uploadedBy: userId,
      organization: orgId,
      title: "Health Test Meeting",
      date: new Date(),
      duration: 60,
      participants: [
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
        { name: "Charlie", email: "charlie@example.com" },
      ],
      agendaItems: [
        { text: "Item 1", status: "completed", actualDuration: 20 * 60000 },
        { text: "Item 2", status: "completed", actualDuration: 25 * 60000 },
        { text: "Item 3", status: "pending", actualDuration: 0 },
      ],
    };
  });

  it("should calculate meeting health correctly based on factors", async () => {
    jest.spyOn(Meeting, "findById").mockResolvedValue(mockMeeting);

    // Add action items
    jest.spyOn(ActionItem, "find").mockResolvedValue([
      {
        text: "Task 1",
        owner: "alice@example.com",
        dueDate: new Date(),
        sourceMeetingId: mockMeeting._id,
        organization: orgId,
      },
      {
        text: "Task 2",
        owner: "Unassigned",
        dueDate: null,
        sourceMeetingId: mockMeeting._id,
        organization: orgId,
      },
    ]);

    // Add feedback
    jest.spyOn(MeetingFeedback, "find").mockResolvedValue([
      {
        meetingId: mockMeeting._id,
        userId: new mongoose.Types.ObjectId().toString(),
        organization: orgId,
        overallRating: 5,
        summaryAccuracy: 5,
        transcriptQuality: 5,
      },
      {
        meetingId: mockMeeting._id,
        userId: new mongoose.Types.ObjectId().toString(),
        organization: orgId,
        overallRating: 3,
        summaryAccuracy: 3,
        transcriptQuality: 3,
      },
    ]);

    // Mock findOneAndUpdate for saving health
    const savedHealth = {
      compositeScore: 73,
      factors: {
        agendaCoverage: 67,
        timeAdherence: 75,
        engagement: 100,
        actionItemClarity: 50,
        sentiment: 75,
      },
      recommendations: [
        "Ensure all action items have a clear owner and due date before ending the meeting.",
      ],
    };
    jest
      .spyOn(MeetingHealth, "findOneAndUpdate")
      .mockResolvedValue(savedHealth);

    const health = await calculateMeetingHealth(mockMeeting._id);

    expect(Meeting.findById).toHaveBeenCalledWith(mockMeeting._id);
    expect(ActionItem.find).toHaveBeenCalledWith({
      sourceMeetingId: mockMeeting._id,
    });
    expect(MeetingFeedback.find).toHaveBeenCalledWith({
      meetingId: mockMeeting._id,
    });

    expect(health.factors.agendaCoverage).toBe(67);
    expect(health.factors.timeAdherence).toBe(75);
    expect(health.factors.actionItemClarity).toBe(50);
    expect(health.factors.sentiment).toBe(75);
    expect(health.factors.engagement).toBe(100);
    expect(health.compositeScore).toBe(73);
    expect(health.recommendations.some((r) => r.includes("action items"))).toBe(
      true,
    );
  });
});
