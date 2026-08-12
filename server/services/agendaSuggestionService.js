import mongoose from "mongoose";
import AgendaSuggestion from "../models/agendaSuggestionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import FollowUpThread from "../models/followUpThreadModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import { generateAgendaSuggestions as generateAI } from "./GenerativeAIService.js";

export class AgendaSuggestionAuthorizationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "AgendaSuggestionAuthorizationError";
    this.statusCode = statusCode;
  }
}

const requireAgendaPermission = (user, action) => {
  if (!user) {
    throw new AgendaSuggestionAuthorizationError(401, "Unauthorized");
  }

  if (!user.organization) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: Organization membership required",
    );
  }

  if (!user.role || !hasPermission(user.role, "meetings", action)) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      `Forbidden: You don't have permission to ${action} meetings`,
    );
  }
};

export const authorizeAgendaMeeting = async (
  user,
  meetingId,
  action = "view",
) => {
  requireAgendaPermission(user, action);

  if (!mongoose.isValidObjectId(meetingId)) {
    throw new AgendaSuggestionAuthorizationError(400, "Invalid meetingId");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new AgendaSuggestionAuthorizationError(404, "Meeting not found");
  }

  if (
    !meeting.organization ||
    meeting.organization.toString() !== user.organization.toString()
  ) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: You don't have access to this meeting",
    );
  }

  return meeting;
};

export const authorizeAgendaSuggestion = async (
  user,
  agendaSuggestion,
  action = "view",
) => {
  requireAgendaPermission(user, action);

  if (!agendaSuggestion) {
    throw new AgendaSuggestionAuthorizationError(
      404,
      "Agenda suggestion not found",
    );
  }

  await authorizeAgendaMeeting(user, agendaSuggestion.meeting, action);

  if (
    !agendaSuggestion.organization ||
    agendaSuggestion.organization.toString() !== user.organization.toString()
  ) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: Agenda suggestion belongs to another organization",
    );
  }

  return agendaSuggestion;
};

export const generateSuggestions = async (meetingId, user) => {
  await authorizeAgendaMeeting(user, meetingId, "edit");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [openActionItems, deferredDecisions, openThreads, recentMeetings] =
    await Promise.all([
      ActionItem.find({
        organization: user.organization,
        status: { $in: ["pending", "in_progress"] },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(20)
        .lean(),

      Decision.find({
        organization: user.organization,
        status: "deferred",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(10)
        .lean(),

      FollowUpThread.find({
        organization: user.organization,
        status: "open",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("topic status createdAt")
        .limit(10)
        .lean(),

      Meeting.find({
        organization: user.organization,
        status: "completed",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("title summary agendaItems")
        .limit(5)
        .lean(),
    ]);

  const aiSuggestions = await generateAI({
    openActionItems,
    deferredDecisions,
    openThreads,
    recentMeetings,
  });

  const suggestions = aiSuggestions.map((s) => ({
    text: s.text,
    description: s.description,
    estimatedDuration: s.estimatedDuration,
    source: {
      type: s.sourceType,
      referenceId: s.sourceId || null,
      title: s.sourceTitle || "AI Suggestion",
    },
    status: "pending",
    acceptedText: "",
  }));

  const agendaSuggestion = new AgendaSuggestion({
    meeting: meetingId,
    organization: user.organization,
    suggestions,
  });

  await agendaSuggestion.save();
  return agendaSuggestion;
};

export const applyAcceptedSuggestions = async (agendaSuggestionId, user) => {
  requireAgendaPermission(user, "edit");

  if (!mongoose.isValidObjectId(agendaSuggestionId)) {
    throw new AgendaSuggestionAuthorizationError(
      400,
      "Invalid agenda suggestion id",
    );
  }

  const agendaSuggestion = await AgendaSuggestion.findById(agendaSuggestionId);
  await authorizeAgendaSuggestion(user, agendaSuggestion, "edit");

  const meeting = await Meeting.findById(agendaSuggestion.meeting);
  if (!meeting) {
    throw new AgendaSuggestionAuthorizationError(404, "Meeting not found");
  }

  const itemsToApply = agendaSuggestion.suggestions.filter(
    (s) => s.status === "accepted" || s.status === "edited",
  );

  const newAgendaItems = itemsToApply.map((s) => ({
    text: s.status === "edited" ? s.acceptedText : s.text,
    description: s.description,
    duration: s.estimatedDuration,
    status: "pending",
  }));

  meeting.agendaItems.push(...newAgendaItems);
  await meeting.save();

  agendaSuggestion.appliedAt = new Date();
  await agendaSuggestion.save();

  return meeting;
};
