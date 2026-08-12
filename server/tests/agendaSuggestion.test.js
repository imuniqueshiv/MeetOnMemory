import mongoose from "mongoose";
import { jest } from "@jest/globals";
import AgendaSuggestion from "../models/agendaSuggestionModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";

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

const {
  generateSuggestions,
  applyAcceptedSuggestions,
  authorizeAgendaMeeting,
} = await import("../services/agendaSuggestionService.js");

const {
  updateSuggestionItem,
  getSuggestionsByMeeting,
} = await import("../controllers/agendaSuggestionController.js");

describe("Agenda Suggestion Service", () => {
  let orgId, foreignOrgId, meetingId, user;

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
    foreignOrgId = new mongoose.Types.ObjectId();
    user = {
      _id: new mongoose.Types.ObjectId(),
      organization: orgId,
      role: "member",
    };

    const meeting = new Meeting({
      title: "Test Meeting",
      date: new Date(),
      organization: orgId,
      uploadedBy: user._id,
      agendaItems: [],
    });
    await meeting.save();
    meetingId = meeting._id;

    const actionItem = new ActionItem({
      text: "Prepare Q2 Marketing Plan",
      status: "open",
      organization: orgId,
      sourceMeetingId: meetingId,
      owner: user._id,
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
    const suggestion = await generateSuggestions(meetingId, user);

    expect(suggestion).toBeDefined();
    expect(suggestion.suggestions).toHaveLength(2);
    expect(suggestion.suggestions[0].text).toBe("Discuss Q2 Marketing");
    expect(suggestion.suggestions[0].status).toBe("pending");
    expect(suggestion.organization.toString()).toBe(orgId.toString());

    const savedSuggestion = await AgendaSuggestion.findById(suggestion._id);
    expect(savedSuggestion).toBeDefined();
    expect(savedSuggestion.suggestions).toHaveLength(2);
  });

  it("blocks access to a meeting in another organization", async () => {
    const foreignMeeting = await Meeting.create({
      title: "Foreign Meeting",
      date: new Date(),
      organization: foreignOrgId,
      uploadedBy: new mongoose.Types.ObjectId(),
      agendaItems: [],
    });

    await expect(
      authorizeAgendaMeeting(user, foreignMeeting._id, "view"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks access when the user has no organization membership", async () => {
    await expect(
      authorizeAgendaMeeting(
        { _id: user._id, role: "member" },
        meetingId,
        "view",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects an unauthenticated caller with 401", async () => {
    await expect(
      authorizeAgendaMeeting(null, meetingId, "view"),
    ).rejects.toMatchObject({ statusCode: 401 });

    await expect(
      applyAcceptedSuggestions(new mongoose.Types.ObjectId(), null),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects an unknown meeting with 404", async () => {
    await expect(
      authorizeAgendaMeeting(user, new mongoose.Types.ObjectId(), "view"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects an invalid meeting id with 400", async () => {
    await expect(
      authorizeAgendaMeeting(user, "not-an-object-id", "view"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("blocks list access for a foreign meeting", async () => {
    const foreignMeeting = await Meeting.create({
      title: "Foreign Meeting",
      date: new Date(),
      organization: foreignOrgId,
      uploadedBy: new mongoose.Types.ObjectId(),
      agendaItems: [],
    });

    await AgendaSuggestion.create({
      meeting: foreignMeeting._id,
      organization: foreignOrgId,
      suggestions: [],
    });

    const req = {
      params: { meetingId: foreignMeeting._id.toString() },
      user,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getSuggestionsByMeeting(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("blocks update access for a foreign agenda suggestion", async () => {
    const foreignMeeting = await Meeting.create({
      title: "Foreign Meeting",
      date: new Date(),
      organization: foreignOrgId,
      uploadedBy: new mongoose.Types.ObjectId(),
      agendaItems: [],
    });
    const foreignSuggestion = await AgendaSuggestion.create({
      meeting: foreignMeeting._id,
      organization: foreignOrgId,
      suggestions: [],
    });

    const req = {
      params: { id: foreignSuggestion._id.toString(), itemId: "missing-item" },
      body: { status: "accepted" },
      user,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await updateSuggestionItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("blocks apply access when the suggestion organization is foreign", async () => {
    const sameOrgMeeting = await Meeting.create({
      title: "Same Organization Meeting",
      date: new Date(),
      organization: orgId,
      uploadedBy: user._id,
      agendaItems: [],
    });
    const foreignSuggestion = await AgendaSuggestion.create({
      meeting: sameOrgMeeting._id,
      organization: foreignOrgId,
      suggestions: [],
    });

    await expect(
      applyAcceptedSuggestions(foreignSuggestion._id, user),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks apply access for a foreign meeting", async () => {
    const foreignMeeting = await Meeting.create({
      title: "Foreign Meeting",
      date: new Date(),
      organization: foreignOrgId,
      uploadedBy: new mongoose.Types.ObjectId(),
      agendaItems: [],
    });
    const foreignSuggestion = await AgendaSuggestion.create({
      meeting: foreignMeeting._id,
      organization: foreignOrgId,
      suggestions: [],
    });

    await expect(
      applyAcceptedSuggestions(foreignSuggestion._id, user),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks edit and apply permissions for viewers", async () => {
    const viewer = { ...user, role: "viewer" };

    await expect(
      authorizeAgendaMeeting(viewer, meetingId, "edit"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("should apply accepted suggestions to the meeting", async () => {
    const suggestion = await generateSuggestions(meetingId, user);

    suggestion.suggestions[0].status = "accepted";
    suggestion.suggestions[1].status = "rejected";
    await suggestion.save();

    const updatedMeeting = await applyAcceptedSuggestions(suggestion._id, user);

    expect(updatedMeeting.agendaItems).toHaveLength(1);
    expect(updatedMeeting.agendaItems[0].text).toBe("Discuss Q2 Marketing");
    expect(updatedMeeting.agendaItems[0].duration).toBe(20);

    const reloadedSuggestion = await AgendaSuggestion.findById(suggestion._id);
    expect(reloadedSuggestion.appliedAt).toBeDefined();
    expect(reloadedSuggestion.appliedAt).not.toBeNull();
  });

  it("should apply edited suggestions with acceptedText", async () => {
    const suggestion = await generateSuggestions(meetingId, user);

    suggestion.suggestions[0].status = "edited";
    suggestion.suggestions[0].acceptedText = "Discuss Q2 Marketing - Updated";
    await suggestion.save();

    const updatedMeeting = await applyAcceptedSuggestions(suggestion._id, user);

    expect(updatedMeeting.agendaItems).toHaveLength(1);
    expect(updatedMeeting.agendaItems[0].text).toBe(
      "Discuss Q2 Marketing - Updated",
    );
  });
});
