import mongoose from "mongoose";
import { jest } from "@jest/globals";
import AgendaSuggestion from "../models/agendaSuggestionModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";

// Mock the AI service
jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateAgendaSuggestions: jest.fn().mockResolvedValue([
    {
      text: "Discuss Q2 Marketing",
      description: "Review marketing strategies for Q2",
      estimatedDuration: 20,
      sourceType: "action_item",
      sourceId: new mongoose.Types.ObjectId().toString(),
      sourceTitle: "From: Q1 Review",
    },
    {
      text: "Budget Approval",
      description: "Approve the new budget",
      estimatedDuration: 15,
      sourceType: "decision",
      sourceTitle: "From: Finance Sync",
    },
  ]),
}));

const { generateSuggestions, applyAcceptedSuggestions } =
  await import("../services/agendaSuggestionService.js");

describe("Agenda Suggestion Service", () => {
  let orgId, meetingId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(
        `${process.env.TEST_MONGODB_URI}/agenda_suggestions`,
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    orgId = new mongoose.Types.ObjectId();

    const meeting = new Meeting({
      title: "Test Meeting",
      date: new Date(),
      organization: orgId,
      uploadedBy: new mongoose.Types.ObjectId(),
      agendaItems: [],
    });
    await meeting.save();
    meetingId = meeting._id;

    const actionItem = new ActionItem({
      text: "Prepare Q2 Marketing Plan",
      status: "open",
      organization: orgId,
      sourceMeetingId: meetingId,
      owner: new mongoose.Types.ObjectId(),
    });
    await actionItem.save();
  });

  afterEach(async () => {
    await Meeting.deleteMany({});
    await ActionItem.deleteMany({});
    await AgendaSuggestion.deleteMany({});
    jest.clearAllMocks();
  });

  it("should generate suggestions and save to DB", async () => {
    const suggestion = await generateSuggestions(orgId, meetingId);

    expect(suggestion).toBeDefined();
    expect(suggestion.suggestions).toHaveLength(2);
    expect(suggestion.suggestions[0].text).toBe("Discuss Q2 Marketing");
    expect(suggestion.suggestions[0].status).toBe("pending");

    const savedSuggestion = await AgendaSuggestion.findById(suggestion._id);
    expect(savedSuggestion).toBeDefined();
    expect(savedSuggestion.suggestions).toHaveLength(2);
  });

  it("should apply accepted suggestions to the meeting", async () => {
    const suggestion = await generateSuggestions(orgId, meetingId);

    // Mark first as accepted, second as rejected
    suggestion.suggestions[0].status = "accepted";
    suggestion.suggestions[1].status = "rejected";
    await suggestion.save();

    const updatedMeeting = await applyAcceptedSuggestions(suggestion._id);

    expect(updatedMeeting.agendaItems).toHaveLength(1);
    expect(updatedMeeting.agendaItems[0].text).toBe("Discuss Q2 Marketing");
    expect(updatedMeeting.agendaItems[0].duration).toBe(20);

    const reloadedSuggestion = await AgendaSuggestion.findById(suggestion._id);
    expect(reloadedSuggestion.appliedAt).toBeDefined();
    expect(reloadedSuggestion.appliedAt).not.toBeNull();
  });

  it("should apply edited suggestions with acceptedText", async () => {
    const suggestion = await generateSuggestions(orgId, meetingId);

    // Mark first as edited
    suggestion.suggestions[0].status = "edited";
    suggestion.suggestions[0].acceptedText = "Discuss Q2 Marketing - Updated";
    await suggestion.save();

    const updatedMeeting = await applyAcceptedSuggestions(suggestion._id);

    expect(updatedMeeting.agendaItems).toHaveLength(1);
    expect(updatedMeeting.agendaItems[0].text).toBe(
      "Discuss Q2 Marketing - Updated",
    );
  });
});
